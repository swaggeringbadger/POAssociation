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
import { imageGenerationService } from './imageGenerationService';
import { pdfReportService, type ReportContext } from './pdfReportService';
import { analysisQueueService } from './analysisQueueService';
import { calculateAnalysisCosts, type AnalysisCosts, type Coordinates } from '@shared/aiAnalysisTypes';
import type { AiAnalysis } from '@shared/schema';

export interface AnalysisWorkerOptions {
  includeSatellite?: boolean;
  includeMockups?: boolean;
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

      // Determine options (defaults for now, could be stored in job data)
      const options: AnalysisWorkerOptions = {
        includeSatellite: true,
        includeMockups: true,
        mockupQuality: 'standard',
        mockupCount: 2,
      };

      // Step 2: Run AI analysis
      console.log(`[AnalysisWorker] Running AI analysis for ${analysis.id}`);
      const { result: aiResult, costs: aiCosts } = await aiAnalysisService.analyzeApplication(analysis);

      // Step 3: Get satellite imagery if enabled
      let satelliteImageUrl: string | undefined;
      let propertyCoordinates: Coordinates | undefined;
      let googleMapsCost = 0;

      if (options.includeSatellite && propertyAddress && googleMapsService.isConfigured()) {
        console.log(`[AnalysisWorker] Fetching satellite imagery for ${analysis.id}`);

        const geocodeResult = await googleMapsService.geocodeAddress(propertyAddress);

        if (geocodeResult) {
          propertyCoordinates = geocodeResult.coordinates;
          satelliteImageUrl = googleMapsService.getSatelliteImageUrl(geocodeResult.coordinates, {
            zoom: 19,
            width: 640,
            height: 640,
            mapType: 'hybrid',
          });
          googleMapsCost = 0.007; // Geocode ($0.005) + Static Map ($0.002)
        }
      }

      // Step 4: Generate AI mockups if enabled
      const mockupUrls: string[] = [];
      let imageGenCost = 0;

      if (options.includeMockups && imageGenerationService.getActiveProvider()) {
        console.log(`[AnalysisWorker] Generating AI mockups for ${analysis.id}`);

        const mockupContext = {
          projectType: application.projectType || '',
          projectDescription: application.description || '',
          propertyAddress,
          formData: (application.formData as Record<string, unknown>) || {},
        };

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

        // Calculate image gen cost
        const costResult = imageGenerationService.calculateCosts({
          standardCount: options.mockupQuality === 'standard' ? mockups.length : 0,
          highCount: options.mockupQuality === 'high' ? mockups.length : 0,
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

      // Add satellite image if available
      if (satelliteImageUrl && propertyCoordinates) {
        try {
          const satelliteData = await googleMapsService.getSatelliteImageBase64(propertyCoordinates);
          if (satelliteData) {
            reportContext.satelliteImage = {
              base64: satelliteData.base64,
              coordinates: propertyCoordinates,
            };
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

      // In production, upload PDF to cloud storage and get URL
      // For now, store as data URL
      const pdfReportUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

      // Step 6: Calculate final costs
      const finalCosts = calculateAnalysisCosts({
        anthropicInputTokens: parseInt(aiCosts.anthropicCostUsd) > 0 ? 1000 : 0, // Placeholder
        anthropicOutputTokens: parseInt(aiCosts.anthropicCostUsd) > 0 ? 2000 : 0,
        googleMapsGeocodeCall: googleMapsCost > 0,
        googleMapsStaticMapCall: googleMapsCost > 0,
        imageGenCount: mockupUrls.length,
        imageGenQuality: options.mockupQuality || 'standard',
      });

      // Add actual costs
      const totalCost = parseFloat(aiCosts.totalCostUsd) + googleMapsCost + imageGenCost;

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
        satelliteImageUrl,
        aiMockupUrls: mockupUrls.length > 0 ? mockupUrls : undefined,
        pdfReportUrl,
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
