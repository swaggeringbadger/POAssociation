/**
 * OCR Worker Service
 *
 * Background worker that processes OCR jobs from the document_ocr_jobs queue.
 * Similar pattern to analysisQueueService.ts but specialized for document OCR.
 *
 * Features:
 * - Polls for queued OCR jobs
 * - Processes documents in batch per application
 * - Updates progress and status in real-time
 * - Handles errors gracefully with retry logic
 */

import { storage } from '../storage';
import { ocrService, type OcrResult, type OcrProcessingOptions } from './ocrService';
import type { DocumentOcrJob } from '@shared/schema';

// Configuration
const POLL_INTERVAL_MS = 5000; // Check for jobs every 5 seconds
const MAX_RETRIES = 2;
const MAX_PROCESSING_TIME_MS = 15 * 60 * 1000; // 15 minutes max per job

export interface OcrJobResult {
  jobId: string;
  status: 'completed' | 'partial' | 'failed';
  processedCount: number;
  totalCount: number;
  results: OcrResult[];
  errors: Array<{ documentId: string; error: string }>;
  totalCostUsd: string;
}

export class OcrWorker {
  private isProcessing = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private currentJobId: string | null = null;

  /**
   * Start the OCR worker polling loop
   */
  start(): void {
    if (this.pollInterval) {
      console.log('[OcrWorker] Worker already running');
      return;
    }

    console.log('[OcrWorker] Starting OCR background worker...');

    this.pollInterval = setInterval(async () => {
      if (this.isProcessing) {
        return;
      }

      try {
        // Check for stale jobs first
        await this.recoverStaleJobs();

        // Get next queued job
        const job = await storage.getNextQueuedOcrJob();

        if (job) {
          this.isProcessing = true;
          this.currentJobId = job.id;
          console.log(`[OcrWorker] Processing OCR job ${job.id} for application ${job.applicationId}`);

          try {
            await this.processJob(job);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[OcrWorker] Job ${job.id} failed:`, message);
            await storage.updateDocumentOcrJob(job.id, {
              status: 'failed',
              errorMessage: message,
              completedAt: new Date(),
            });
          } finally {
            this.isProcessing = false;
            this.currentJobId = null;
          }
        }
      } catch (error) {
        console.error('[OcrWorker] Error in poll loop:', error);
      }
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop the OCR worker
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[OcrWorker] Worker stopped');
    }
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.pollInterval !== null;
  }

  /**
   * Get current job being processed
   */
  getCurrentJobId(): string | null {
    return this.currentJobId;
  }

  /**
   * Process an OCR job
   */
  private async processJob(job: DocumentOcrJob): Promise<OcrJobResult> {
    // Mark job as processing
    await storage.updateDocumentOcrJob(job.id, {
      status: 'processing',
      startedAt: new Date(),
    });

    const results: OcrResult[] = [];
    const errors: Array<{ documentId: string; error: string }> = [];
    let processedCount = 0;

    // Get all documents for the application that need OCR
    const documents = await storage.getDocumentsNeedingOcr(job.applicationId);

    if (documents.length === 0) {
      console.log(`[OcrWorker] No documents need OCR for application ${job.applicationId}`);
      await storage.updateDocumentOcrJob(job.id, {
        status: 'completed',
        processedDocuments: 0,
        completedAt: new Date(),
      });

      return {
        jobId: job.id,
        status: 'completed',
        processedCount: 0,
        totalCount: 0,
        results: [],
        errors: [],
        totalCostUsd: '0',
      };
    }

    const processingOptions: OcrProcessingOptions = {
      includeImageEnhancement: job.includeImageEnhancement ?? true,
      enhancementConfidenceThreshold: 80,
    };

    // Process each document
    for (const doc of documents) {
      try {
        console.log(`[OcrWorker] Processing document ${doc.id}: ${doc.fileName}`);

        const result = await ocrService.processDocument(doc.id, processingOptions);
        results.push(result);
        processedCount++;

        // Update progress
        await storage.updateDocumentOcrJob(job.id, {
          processedDocuments: processedCount,
        });

        console.log(`[OcrWorker] Document ${doc.id} complete (${processedCount}/${documents.length})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[OcrWorker] Failed to process document ${doc.id}:`, errorMessage);
        errors.push({ documentId: doc.id, error: errorMessage });

        // Mark document as failed but continue with others
        await storage.updateDocumentOcr(doc.id, {
          ocrStatus: 'failed',
          ocrError: errorMessage,
        });
      }
    }

    // Calculate cost
    const costEstimate = ocrService.calculateEstimatedCost(processedCount);

    // Determine final status
    const finalStatus = errors.length === 0
      ? 'completed'
      : processedCount > 0
        ? 'partial'
        : 'failed';

    // Update job as complete
    await storage.updateDocumentOcrJob(job.id, {
      status: finalStatus === 'partial' ? 'completed' : finalStatus, // Store partial as completed
      processedDocuments: processedCount,
      totalCostUsd: costEstimate.totalUsd,
      completedAt: new Date(),
      errorMessage: errors.length > 0
        ? `${errors.length} document(s) failed: ${errors.map(e => e.documentId).join(', ')}`
        : undefined,
    });

    console.log(`[OcrWorker] Job ${job.id} ${finalStatus}: ${processedCount}/${documents.length} documents processed`);

    return {
      jobId: job.id,
      status: finalStatus,
      processedCount,
      totalCount: documents.length,
      results,
      errors,
      totalCostUsd: costEstimate.totalUsd,
    };
  }

  /**
   * Recover jobs that got stuck in processing state
   */
  private async recoverStaleJobs(): Promise<void> {
    try {
      const staleJobs = await storage.getStaleOcrJobs(MAX_PROCESSING_TIME_MS);

      for (const job of staleJobs) {
        console.warn(`[OcrWorker] Recovering stale job ${job.id}`);
        await storage.updateDocumentOcrJob(job.id, {
          status: 'failed',
          errorMessage: 'Job timed out - processing exceeded maximum time',
          completedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[OcrWorker] Error recovering stale jobs:', error);
    }
  }

  /**
   * Queue a new OCR job for an application
   */
  async queueOcrJob(params: {
    applicationId: string;
    requestedByUserId?: string;
    includeImageEnhancement?: boolean;
  }): Promise<DocumentOcrJob> {
    const { applicationId, requestedByUserId, includeImageEnhancement = true } = params;

    // Check if there's already a pending job for this application
    const existingJob = await storage.getPendingOcrJob(applicationId);
    if (existingJob) {
      console.log(`[OcrWorker] OCR job already pending for application ${applicationId}`);
      return existingJob;
    }

    // Get document count
    const documents = await storage.getDocumentsNeedingOcr(applicationId);

    // Create the job
    const job = await storage.createDocumentOcrJob({
      applicationId,
      requestedByUserId: requestedByUserId || null,
      status: 'queued',
      totalDocuments: documents.length,
      processedDocuments: 0,
      includeImageEnhancement,
    });

    console.log(`[OcrWorker] Queued OCR job ${job.id} for ${documents.length} documents`);

    return job;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    processedDocuments: number;
    totalDocuments: number;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }> {
    const job = await storage.getDocumentOcrJob(jobId);

    if (!job) {
      throw new Error(`OCR job ${jobId} not found`);
    }

    const progress = job.totalDocuments > 0
      ? Math.round((job.processedDocuments || 0) / job.totalDocuments * 100)
      : 0;

    return {
      status: job.status,
      progress,
      processedDocuments: job.processedDocuments || 0,
      totalDocuments: job.totalDocuments,
      error: job.errorMessage || undefined,
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined,
    };
  }

  /**
   * Get OCR results for an application
   */
  async getOcrResults(applicationId: string): Promise<Array<{
    documentId: string;
    fileName: string;
    ocrText: string | null;
    ocrConfidence: number | null;
    ocrStatus: string | null;
    isHandwritten: boolean;
    ocrError: string | null;
  }>> {
    const documents = await storage.getDocumentsWithOcr(applicationId);

    return documents.map(doc => ({
      documentId: doc.id,
      fileName: doc.fileName,
      ocrText: doc.ocrText,
      ocrConfidence: doc.ocrConfidence,
      ocrStatus: doc.ocrStatus,
      isHandwritten: doc.isHandwritten ?? false,
      ocrError: doc.ocrError,
    }));
  }
}

// Export singleton instance
export const ocrWorker = new OcrWorker();
