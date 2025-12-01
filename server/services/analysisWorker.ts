/**
 * Analysis Worker
 *
 * Orchestrates the full AI analysis pipeline by coordinating:
 * 1. AI Analysis Service (Anthropic Claude)
 * 2. Google Maps Service (geocoding + satellite)
 * 3. Image Generation Service (AI mockups)
 * 4. PDF Report Service (report generation)
 *
 * This worker is called by the queue service when processing jobs.
 */

import { storage } from '../storage';
import { aiAnalysisService } from './aiAnalysisService';
import { googleMapsService } from './googleMapsService';
import { propertyBoundaryService } from './propertyBoundaryService';
import { imageGenerationService } from './imageGenerationService';
import { pdfReportService, type ReportContext, type BreakdownReportContext } from './pdfReportService';
import { analysisQueueService } from './analysisQueueService';
import { azureBlobStorage } from '../azureBlobStorage';
import { calculateAnalysisCosts, type AnalysisCosts, type Coordinates, type BreakdownReportResult } from '@shared/aiAnalysisTypes';
import type { AiAnalysis } from '@shared/schema';

// Container name for AI analysis reports
const AI_REPORTS_CONTAINER = 'ai-analysis-reports';

export interface AnalysisWorkerOptions {
  includeSatellite?: boolean;
  includeMockups?: boolean;
  includeBreakdownReport?: boolean;
  mockupQuality?: 'standard' | 'high';
  mockupCount?: number;
}

export class AnalysisWorker {
  /**
   * Process a single analysis job
   * This is the main entry point called by the queue
   */
  async processJob(analysis: AiAnalysis): Promise<void> {
    const startTime = Date.now();
    console.log(`[AnalysisWorker] Starting job ${analysis.id}`);

    try {
      // Step 1: Get application and property info
      const application = await storage.getApplication(analysis.applicationId);
      if (!application) {
        throw new Error(`Application ${analysis.applicationId} not found`);
      }

      const tenant = await storage.getTenant(analysis.tenantId);
      const propertyAddress = application.propertyAddress || '';

      // Read options from job data stored in the analysis record
      const jobOptions = (analysis.jobOptions as AnalysisWorkerOptions) || {};
      const options: AnalysisWorkerOptions = {
        includeSatellite: jobOptions.includeSatellite ?? true,
        includeMockups: jobOptions.includeMockups ?? true,
        includeBreakdownReport: jobOptions.includeBreakdownReport ?? false,
        mockupQuality: jobOptions.mockupQuality ?? 'standard',
        mockupCount: 2,
      };

      // Step 2: Run AI analysis
      console.log(`[AnalysisWorker] Running AI analysis for ${analysis.id}`);
      const { result: aiResult, costs: aiCosts } = await aiAnalysisService.analyzeApplication(analysis);

      // Step 3: Get satellite imagery if enabled
      let satelliteImageUrl: string | undefined;
      let propertyCoordinates: Coordinates | undefined;
      let googleMapsCost = 0;

      if (options.includeSatellite && googleMapsService.isConfigured()) {
        console.log(`[AnalysisWorker] Fetching satellite imagery for ${analysis.id}`);

        // Use pre-validated coordinates from Radar if available, otherwise geocode with Google
        const storedCoords = application.propertyCoordinates as { lat: number; lng: number } | null;

        if (storedCoords?.lat && storedCoords?.lng) {
          // Use coordinates from Radar validation (saves a Google Geocoding API call!)
          console.log(`[AnalysisWorker] Using pre-validated coordinates from Radar`);
          propertyCoordinates = { lat: storedCoords.lat, lng: storedCoords.lng };
          googleMapsCost = 0.002; // Only Static Map cost
        } else if (propertyAddress) {
          // Fall back to Google Geocoding
          console.log(`[AnalysisWorker] Geocoding address with Google Maps`);
          const geocodeResult = await googleMapsService.geocodeAddress(propertyAddress);
          if (geocodeResult) {
            propertyCoordinates = geocodeResult.coordinates;
            googleMapsCost = 0.007; // Geocode ($0.005) + Static Map ($0.002)
          }
        }

        if (propertyCoordinates) {
          satelliteImageUrl = googleMapsService.getSatelliteImageUrl(propertyCoordinates, {
            zoom: 19,
            width: 640,
            height: 640,
            mapType: 'hybrid',
          });
        }
      }

      // Step 4: Get satellite image base64 for AI image generation
      let satelliteImageBase64: string | undefined;

      if (options.includeSatellite && propertyCoordinates && googleMapsService.isConfigured()) {
        console.log(`[AnalysisWorker] Fetching satellite image for AI mockup generation`);
        try {
          const satelliteData = await googleMapsService.getSatelliteImageBase64(propertyCoordinates, {
            zoom: 19,
            width: 640,
            height: 640,
          });
          if (satelliteData) {
            satelliteImageBase64 = satelliteData.base64;
            console.log(`[AnalysisWorker] Satellite image fetched for AI mockup context (${satelliteImageBase64.length} bytes base64)`);
          }
        } catch (error) {
          console.warn('[AnalysisWorker] Failed to fetch satellite image for mockups:', error);
        }
      }

      // Step 5: Generate AI mockups and blueprint if enabled
      const mockupUrls: string[] = [];
      let blueprintUrl: string | undefined;
      let imageGenCost = 0;

      if (options.includeMockups && imageGenerationService.getActiveProvider()) {
        console.log(`[AnalysisWorker] Generating AI mockups for ${analysis.id}`);

        const mockupContext = {
          projectType: application.projectType || '',
          projectDescription: application.description || '',
          propertyAddress,
          formData: (application.formData as Record<string, unknown>) || {},
          satelliteImageBase64, // Pass satellite image to AI for context
        };

        if (satelliteImageBase64) {
          console.log(`[AnalysisWorker] Including satellite image in AI mockup context for property-specific generation`);
        } else {
          console.log(`[AnalysisWorker] No satellite image available - AI will generate generic mockups`);
        }

        // Generate mockups
        const mockups = await imageGenerationService.generateMockupVariations(
          mockupContext,
          options.mockupCount || 2,
          { quality: options.mockupQuality }
        );

        // Store mockups (in production, upload to cloud storage)
        for (const mockup of mockups) {
          // For now, store as data URLs (in production, upload to S3/GCS)
          mockupUrls.push(`data:${mockup.mimeType};base64,${mockup.base64}`);
        }

        // Generate blueprint-style site plan
        console.log(`[AnalysisWorker] Generating blueprint for ${analysis.id}`);
        const blueprint = await imageGenerationService.generateBlueprint(
          mockupContext,
          { quality: options.mockupQuality }
        );

        if (blueprint) {
          blueprintUrl = `data:${blueprint.mimeType};base64,${blueprint.base64}`;
          console.log(`[AnalysisWorker] Blueprint generated successfully`);
        }

        // Calculate image gen cost (mockups + blueprint)
        const totalImages = mockups.length + (blueprint ? 1 : 0);
        const costResult = imageGenerationService.calculateCosts({
          standardCount: options.mockupQuality === 'standard' ? totalImages : 0,
          highCount: options.mockupQuality === 'high' ? totalImages : 0,
          provider: 'stability_ai',
        });
        imageGenCost = parseFloat(costResult.total);
      }

      // Step 5: Generate PDF report
      console.log(`[AnalysisWorker] Generating PDF report for ${analysis.id}`);

      const reportContext: ReportContext = {
        analysis,
        result: aiResult,
        application: {
          applicationNumber: application.applicationNumber || '',
          projectType: application.projectType || '',
          title: application.title || '',
          description: application.description || '',
          propertyAddress,
          submittedAt: application.submittedAt || new Date(),
        },
        tenant: {
          name: tenant?.name || 'Unknown Community',
          logoUrl: (tenant as { logoUrl?: string })?.logoUrl || undefined,
        },
      };

      // Add satellite image with property boundary if available
      let satelliteImageBlobUrl: string | undefined;
      if (satelliteImageUrl && propertyCoordinates) {
        try {
          // Get form data to determine lot type
          const formData = (application.formData as Record<string, unknown>) || {};
          const lotType = propertyBoundaryService.determineLotType(formData);

          console.log(`[AnalysisWorker] Generating enhanced satellite images with property boundary (lot type: ${lotType})`);

          // Try to get enhanced images with property boundary
          const enhancedImages = await propertyBoundaryService.getEnhancedSatelliteImages(
            propertyCoordinates,
            { lotType }
          );

          if (enhancedImages) {
            // Add enhanced images to report context
            reportContext.propertyBoundaryImage = {
              base64: enhancedImages.propertyViewBase64,
              coordinates: propertyCoordinates,
            };
            reportContext.neighborhoodContextImage = {
              base64: enhancedImages.neighborhoodViewBase64,
              coordinates: propertyCoordinates,
            };

            // Also set basic satellite image as fallback
            reportContext.satelliteImage = {
              base64: enhancedImages.propertyViewBase64,
              coordinates: propertyCoordinates,
            };

            // Upload property boundary image to blob storage
            if (azureBlobStorage.isAvailable()) {
              const satelliteBlobPath = `${analysis.tenantId}/${analysis.applicationId}/${analysis.id}-satellite.png`;
              const imageBuffer = Buffer.from(enhancedImages.propertyViewBase64, 'base64');
              await azureBlobStorage.uploadFile(
                AI_REPORTS_CONTAINER,
                imageBuffer,
                'satellite.png',
                'image/png',
                satelliteBlobPath
              );
              satelliteImageBlobUrl = `/api/ai/analysis/${analysis.id}/satellite`;
              console.log(`[AnalysisWorker] Enhanced satellite image uploaded to blob storage: ${satelliteBlobPath}`);
            }

            // Extra API cost for enhanced images (2 static map calls instead of 1)
            googleMapsCost += 0.002;
          } else {
            // Fall back to basic satellite image
            console.log(`[AnalysisWorker] Falling back to basic satellite image`);
            const satelliteData = await googleMapsService.getSatelliteImageBase64(propertyCoordinates);
            if (satelliteData) {
              reportContext.satelliteImage = {
                base64: satelliteData.base64,
                coordinates: propertyCoordinates,
              };

              if (azureBlobStorage.isAvailable()) {
                const satelliteBlobPath = `${analysis.tenantId}/${analysis.applicationId}/${analysis.id}-satellite.png`;
                const imageBuffer = Buffer.from(satelliteData.base64, 'base64');
                await azureBlobStorage.uploadFile(
                  AI_REPORTS_CONTAINER,
                  imageBuffer,
                  'satellite.png',
                  'image/png',
                  satelliteBlobPath
                );
                satelliteImageBlobUrl = `/api/ai/analysis/${analysis.id}/satellite`;
                console.log(`[AnalysisWorker] Basic satellite image uploaded to blob storage: ${satelliteBlobPath}`);
              }
            }
          }
        } catch (error) {
          console.warn('[AnalysisWorker] Failed to fetch satellite image for PDF:', error);
        }
      }

      // Add mockups if available
      if (mockupUrls.length > 0) {
        reportContext.mockupImages = mockupUrls.map((url, index) => ({
          base64: url.split(',')[1], // Extract base64 from data URL
          description: `AI-generated mockup ${index + 1}`,
        }));
      }

      const pdfBuffer = await pdfReportService.generateReport(reportContext);

      // Upload PDF to Azure Blob Storage if available, otherwise fall back to data URL
      let pdfReportUrl: string;
      if (azureBlobStorage.isAvailable()) {
        const pdfBlobPath = `${analysis.tenantId}/${analysis.applicationId}/${analysis.id}-report.pdf`;
        const uploadResult = await azureBlobStorage.uploadFile(
          AI_REPORTS_CONTAINER,
          pdfBuffer,
          'analysis-report.pdf',
          'application/pdf',
          pdfBlobPath
        );
        // Store the blob path - we'll serve it through our API endpoint
        pdfReportUrl = `/api/ai/analysis/${analysis.id}/report`;
        console.log(`[AnalysisWorker] PDF uploaded to blob storage: ${pdfBlobPath}`);
      } else {
        // Fallback to data URL (not recommended for production)
        console.warn('[AnalysisWorker] Azure Blob Storage not configured, storing PDF as data URL');
        pdfReportUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      }

      // Step 5b: Generate breakdown report if requested
      let breakdownResult: BreakdownReportResult | undefined;
      let breakdownPdfReportUrl: string | undefined;
      let breakdownCosts = { anthropicCostUsd: '0', totalCostUsd: '0' };

      if (options.includeBreakdownReport) {
        console.log(`[AnalysisWorker] Generating breakdown report for ${analysis.id}`);

        try {
          const breakdownResponse = await aiAnalysisService.generateBreakdownReport(analysis);
          breakdownResult = breakdownResponse.result;
          breakdownCosts = breakdownResponse.costs;

          // Get applicant name
          let applicantName = '';
          const applicantUser = await storage.getUser(application.submittedByUserId);
          if (applicantUser) {
            applicantName = `${applicantUser.firstName || ''} ${applicantUser.lastName || ''}`.trim() || applicantUser.email || '';
          }

          // Get lot type from form data
          const formData = (application.formData as Record<string, unknown>) || {};
          const lotType = (formData.lot_type as string) || (formData.lotType as string) || '';

          // Get tenant settings
          const tenantSettings = tenant?.settings as { countyJurisdiction?: string } | undefined;

          // Generate breakdown PDF
          const breakdownReportContext: BreakdownReportContext = {
            analysis,
            result: breakdownResult,
            application: {
              applicationNumber: application.applicationNumber || '',
              projectType: application.projectType || '',
              title: application.title || '',
              description: application.description || '',
              propertyAddress,
              submittedAt: application.submittedAt || new Date(),
              lotType,
              applicantName,
            },
            tenant: {
              name: tenant?.name || 'Unknown Community',
              logoUrl: (tenant as { logoUrl?: string })?.logoUrl || undefined,
              countyJurisdiction: tenantSettings?.countyJurisdiction,
            },
          };

          // Add satellite images if available (including enhanced property boundary images)
          if (reportContext.satelliteImage) {
            breakdownReportContext.satelliteImage = reportContext.satelliteImage;
          }
          if (reportContext.propertyBoundaryImage) {
            breakdownReportContext.propertyBoundaryImage = reportContext.propertyBoundaryImage;
          }
          if (reportContext.neighborhoodContextImage) {
            breakdownReportContext.neighborhoodContextImage = reportContext.neighborhoodContextImage;
          }

          const breakdownPdfBuffer = await pdfReportService.generateBreakdownReport(breakdownReportContext);

          // Upload breakdown PDF to blob storage if available
          if (azureBlobStorage.isAvailable()) {
            const breakdownBlobPath = `${analysis.tenantId}/${analysis.applicationId}/${analysis.id}-breakdown.pdf`;
            await azureBlobStorage.uploadFile(
              AI_REPORTS_CONTAINER,
              breakdownPdfBuffer,
              'breakdown-report.pdf',
              'application/pdf',
              breakdownBlobPath
            );
            breakdownPdfReportUrl = `/api/ai/analysis/${analysis.id}/breakdown-report`;
            console.log(`[AnalysisWorker] Breakdown PDF uploaded to blob storage: ${breakdownBlobPath}`);
          } else {
            breakdownPdfReportUrl = `data:application/pdf;base64,${breakdownPdfBuffer.toString('base64')}`;
          }

          console.log(`[AnalysisWorker] Breakdown report generated for ${analysis.id}`);
        } catch (error) {
          console.error('[AnalysisWorker] Failed to generate breakdown report:', error);
          // Continue without breakdown report - don't fail the whole analysis
        }
      }

      // Step 6: Calculate final costs
      const finalCosts = calculateAnalysisCosts({
        anthropicInputTokens: parseInt(aiCosts.anthropicCostUsd) > 0 ? 1000 : 0, // Placeholder
        anthropicOutputTokens: parseInt(aiCosts.anthropicCostUsd) > 0 ? 2000 : 0,
        googleMapsGeocodeCall: googleMapsCost > 0,
        googleMapsStaticMapCall: googleMapsCost > 0,
        imageGenCount: mockupUrls.length,
        imageGenQuality: options.mockupQuality || 'standard',
      });

      // Add actual costs (including breakdown report if generated)
      const breakdownExtraCost = parseFloat(breakdownCosts.totalCostUsd || '0');
      const totalCost = parseFloat(aiCosts.totalCostUsd) + googleMapsCost + imageGenCost + breakdownExtraCost;

      // Step 7: Complete the job with results
      const processingDurationMs = Date.now() - startTime;
      console.log(`[AnalysisWorker] Completing job ${analysis.id} (${processingDurationMs}ms)`);

      await analysisQueueService.completeJob(analysis.id, {
        complianceScore: aiResult.complianceScore,
        riskLevel: aiResult.riskLevel,
        overallSummary: aiResult.overallSummary,
        bylawCompliance: aiResult.bylawCompliance,
        riskAssessment: aiResult.riskAssessment,
        questionsConcerns: aiResult.questionsConcerns,
        recommendations: aiResult.recommendations,
        propertyCoordinates: propertyCoordinates,
        satelliteImageUrl: satelliteImageBlobUrl || satelliteImageUrl,
        aiMockupUrls: mockupUrls.length > 0 ? mockupUrls : undefined,
        blueprintUrls: blueprintUrl ? [blueprintUrl] : undefined,
        pdfReportUrl,
        breakdownReport: breakdownResult,
        breakdownPdfReportUrl,
        anthropicTokensUsed: parseInt(finalCosts.anthropicTokensUsed.toString()),
        anthropicCostUsd: aiCosts.anthropicCostUsd,
        googleMapsCostUsd: googleMapsCost.toFixed(4),
        imageGenCostUsd: imageGenCost.toFixed(4),
        totalCostUsd: totalCost.toFixed(4),
        processingDurationMs,
      });

      console.log(`[AnalysisWorker] Job ${analysis.id} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AnalysisWorker] Job ${analysis.id} failed:`, errorMessage);

      // The queue service handles retries
      throw error;
    }
  }

  /**
   * Start the worker process
   * Registers with the queue service to receive jobs
   */
  start(): void {
    console.log('[AnalysisWorker] Starting worker...');

    analysisQueueService.startWorker(async (analysis: AiAnalysis) => {
      await this.processJob(analysis);
    });

    console.log('[AnalysisWorker] Worker started and listening for jobs');
  }

  /**
   * Stop the worker process
   */
  stop(): void {
    console.log('[AnalysisWorker] Stopping worker...');
    analysisQueueService.stopWorker();
    console.log('[AnalysisWorker] Worker stopped');
  }
}

// Export singleton instance
export const analysisWorker = new AnalysisWorker();
