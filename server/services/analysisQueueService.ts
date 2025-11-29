/**
 * Analysis Queue Service
 *
 * Database-backed job queue for AI analysis processing.
 * Uses the ai_analyses table with status field for queue management.
 *
 * Queue States:
 * - queued: Job is waiting to be processed
 * - processing: Worker is actively working on job
 * - completed: Job finished successfully
 * - failed: Job failed (see errorMessage)
 *
 * This is an MVP implementation. For production scale,
 * upgrade to BullMQ with Redis for better reliability.
 */

import { storage } from '../storage';
import { aiCreditService } from './aiCreditService';
import type { AiAnalysis, InsertAiAnalysis } from '@shared/schema';
import type { AnalysisJobData, TriggerAnalysisResponse } from '@shared/aiAnalysisTypes';

// Estimated processing time in seconds (for UI feedback)
const ESTIMATED_PROCESSING_TIME = 90;

// Maximum retry attempts for failed jobs
const MAX_RETRIES = 3;

export class AnalysisQueueService {
  private isProcessing = false;
  private pollInterval: NodeJS.Timeout | null = null;

  /**
   * Queue a new analysis job
   * Validates credits and creates the analysis record
   */
  async queueAnalysis(params: {
    applicationId: string;
    tenantId: string;
    requestedByUserId: string;
    includeSatellite?: boolean;
    includeMockups?: boolean;
    mockupQuality?: 'standard' | 'high';
    demoCodeId?: string;
    priority?: number;
  }): Promise<TriggerAnalysisResponse> {
    const {
      applicationId,
      tenantId,
      requestedByUserId,
      includeSatellite = true,
      includeMockups = true,
      mockupQuality = 'standard',
      demoCodeId,
      priority = 0,
    } = params;

    // Check if tenant has credits
    const creditCheck = await aiCreditService.checkCredits(tenantId);

    if (!creditCheck.hasAccess) {
      throw new Error(creditCheck.reason || 'AI Analysis not available');
    }

    if (!creditCheck.hasCredits) {
      throw new Error('No AI analysis credits remaining');
    }

    // Check for existing pending analysis for this application
    const existingAnalyses = await storage.getAiAnalysisForApplication(applicationId);
    const pendingAnalysis = existingAnalyses.find(
      a => a.status === 'queued' || a.status === 'processing'
    );

    if (pendingAnalysis) {
      throw new Error('An analysis is already in progress for this application');
    }

    // Create the analysis record (this queues the job)
    const analysisData: InsertAiAnalysis = {
      applicationId,
      tenantId,
      requestedByUserId,
      status: 'queued',
      priority,
      demoCodeId,
    };

    const analysis = await storage.createAiAnalysis(analysisData);

    // Store job data in a way the worker can access
    // For now, we'll reconstruct from the analysis record
    // In a full implementation, you'd use a separate job data store

    return {
      analysisId: analysis.id,
      status: 'queued',
      estimatedTimeSeconds: ESTIMATED_PROCESSING_TIME,
      creditsRemaining: creditCheck.remaining - 1, // Will be deducted on completion
      isOverage: creditCheck.isOverage,
    };
  }

  /**
   * Get the next queued job for processing
   * Returns null if no jobs are available
   */
  async getNextJob(): Promise<AiAnalysis | null> {
    const analysis = await storage.getNextQueuedAiAnalysis();
    return analysis || null;
  }

  /**
   * Mark a job as processing
   */
  async startProcessing(analysisId: string): Promise<AiAnalysis> {
    return storage.updateAiAnalysisStatus(analysisId, 'processing');
  }

  /**
   * Mark a job as completed with results
   */
  async completeJob(
    analysisId: string,
    results: Partial<AiAnalysis>
  ): Promise<AiAnalysis> {
    // Get the analysis to get tenantId for credit deduction
    const analysis = await storage.getAiAnalysis(analysisId);

    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    // Calculate processing duration
    const processingDurationMs = analysis.startedAt
      ? Date.now() - new Date(analysis.startedAt).getTime()
      : undefined;

    // Update analysis with results
    const updated = await storage.updateAiAnalysis(analysisId, {
      ...results,
      status: 'completed',
      completedAt: new Date(),
      processingDurationMs,
    });

    // Deduct credit from tenant
    await aiCreditService.deductCredit(analysis.tenantId);

    return updated;
  }

  /**
   * Mark a job as failed
   */
  async failJob(analysisId: string, errorMessage: string): Promise<AiAnalysis> {
    const analysis = await storage.getAiAnalysis(analysisId);

    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    const retryCount = (analysis.retryCount || 0) + 1;

    // If we haven't exceeded max retries, re-queue the job
    if (retryCount < MAX_RETRIES) {
      return storage.updateAiAnalysis(analysisId, {
        status: 'queued',
        retryCount,
        errorMessage: `Retry ${retryCount}/${MAX_RETRIES}: ${errorMessage}`,
      });
    }

    // Max retries exceeded, mark as permanently failed
    return storage.updateAiAnalysisStatus(analysisId, 'failed', errorMessage);
  }

  /**
   * Get status of a specific analysis
   */
  async getStatus(analysisId: string): Promise<{
    status: string;
    progress?: string;
    estimatedTimeRemaining?: number;
    error?: string;
  }> {
    const analysis = await storage.getAiAnalysis(analysisId);

    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    const result: {
      status: string;
      progress?: string;
      estimatedTimeRemaining?: number;
      error?: string;
    } = {
      status: analysis.status,
    };

    if (analysis.status === 'queued') {
      result.progress = 'Waiting in queue...';
      result.estimatedTimeRemaining = ESTIMATED_PROCESSING_TIME;
    } else if (analysis.status === 'processing') {
      const elapsed = analysis.startedAt
        ? Math.floor((Date.now() - new Date(analysis.startedAt).getTime()) / 1000)
        : 0;
      result.progress = 'Analyzing application...';
      result.estimatedTimeRemaining = Math.max(0, ESTIMATED_PROCESSING_TIME - elapsed);
    } else if (analysis.status === 'failed') {
      result.error = analysis.errorMessage || 'Unknown error';
    }

    return result;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queuedCount: number;
    processingCount: number;
    completedToday: number;
    failedToday: number;
    averageWaitTimeMs: number;
  }> {
    // This would be more efficient with a dedicated query
    // For now, we'll use the existing stats method
    const stats = await storage.getAiAnalysisStats();

    return {
      queuedCount: stats.pendingAnalyses,
      processingCount: 0, // Would need separate query
      completedToday: 0, // Would need date filter
      failedToday: 0, // Would need date filter
      averageWaitTimeMs: 0, // Would need calculation
    };
  }

  /**
   * Start the background worker polling
   * Call this when the server starts
   */
  startWorker(processJob: (analysis: AiAnalysis) => Promise<void>): void {
    if (this.pollInterval) {
      console.log('[AnalysisQueue] Worker already running');
      return;
    }

    console.log('[AnalysisQueue] Starting background worker...');

    // Poll every 5 seconds for new jobs
    this.pollInterval = setInterval(async () => {
      if (this.isProcessing) {
        return; // Don't start new job if one is processing
      }

      try {
        const job = await this.getNextJob();

        if (job) {
          this.isProcessing = true;
          console.log(`[AnalysisQueue] Processing job ${job.id}`);

          try {
            await this.startProcessing(job.id);
            await processJob(job);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[AnalysisQueue] Job ${job.id} failed:`, message);
            await this.failJob(job.id, message);
          } finally {
            this.isProcessing = false;
          }
        }
      } catch (error) {
        console.error('[AnalysisQueue] Error polling for jobs:', error);
      }
    }, 5000);
  }

  /**
   * Stop the background worker
   * Call this when the server shuts down
   */
  stopWorker(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[AnalysisQueue] Worker stopped');
    }
  }

  /**
   * Check if worker is running
   */
  isWorkerRunning(): boolean {
    return this.pollInterval !== null;
  }

  /**
   * Cancel a queued analysis
   * Can only cancel jobs that haven't started processing
   */
  async cancelAnalysis(analysisId: string, userId: string): Promise<boolean> {
    const analysis = await storage.getAiAnalysis(analysisId);

    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    if (analysis.status !== 'queued') {
      throw new Error('Can only cancel queued analyses');
    }

    // Verify user has permission (must be requester or admin)
    if (analysis.requestedByUserId !== userId) {
      // TODO: Check if user is admin for the tenant
      throw new Error('Not authorized to cancel this analysis');
    }

    await storage.updateAiAnalysisStatus(analysisId, 'failed', 'Cancelled by user');
    return true;
  }
}

// Export singleton instance
export const analysisQueueService = new AnalysisQueueService();
