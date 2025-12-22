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
import { communitySubscriptionService } from './communitySubscriptionService';
import { applicationEventService } from './applicationEventService';
import type { AiAnalysis, InsertAiAnalysis } from '@shared/schema';
import type { AnalysisJobData, TriggerAnalysisResponse } from '@shared/aiAnalysisTypes';

// Lazy import to avoid circular dependency
const getUsageTrackingService = async () => {
  const { usageTrackingService } = await import('./usageTrackingService');
  return usageTrackingService;
};

// Estimated processing time in seconds (for UI feedback)
// AI analysis typically takes 7-8 minutes including image generation
const ESTIMATED_PROCESSING_TIME = 450;

// Maximum retry attempts for failed jobs
const MAX_RETRIES = 3;

// Maximum time a job can be in processing state before considered stale (10 minutes)
const MAX_PROCESSING_TIME_MS = 10 * 60 * 1000;

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
    includeBreakdownReport?: boolean;
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
      includeBreakdownReport = false,
      mockupQuality = 'standard',
      demoCodeId,
      priority = 0,
    } = params;

    // Check if tenant has credits (using new community subscription system)
    // The new system uses a soft cap - always allows analysis but charges overage fees
    const creditCheck = await communitySubscriptionService.checkCredits(tenantId);

    if (!creditCheck.hasCredits) {
      // No subscription found - this shouldn't happen but handle gracefully
      throw new Error('No active subscription found. Please set up your subscription.');
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
      jobOptions: {
        includeSatellite,
        includeMockups,
        includeBreakdownReport,
        mockupQuality,
      },
    };

    const analysis = await storage.createAiAnalysis(analysisData);

    // Emit event for timeline
    try {
      await applicationEventService.emitAiAnalysisQueued({
        applicationId,
        tenantId,
        userId: requestedByUserId,
        analysisId: analysis.id,
        demoCodeId,
      });
    } catch (e) {
      console.error('[AnalysisQueue] Failed to emit queued event:', e);
    }

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
    const updated = await storage.updateAiAnalysisStatus(analysisId, 'processing');

    // Emit event for timeline
    try {
      await applicationEventService.emitAiAnalysisStarted({
        applicationId: updated.applicationId,
        tenantId: updated.tenantId,
        userId: updated.requestedByUserId || undefined,
        analysisId: updated.id,
        demoCodeId: updated.demoCodeId || undefined,
      });
    } catch (e) {
      console.error('[AnalysisQueue] Failed to emit started event:', e);
    }

    return updated;
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

    // Emit event for timeline
    try {
      await applicationEventService.emitAiAnalysisCompleted({
        applicationId: updated.applicationId,
        tenantId: updated.tenantId,
        userId: updated.requestedByUserId || undefined,
        analysisId: updated.id,
        complianceScore: updated.complianceScore || 0,
        riskLevel: updated.riskLevel || 'unknown',
        recommendation: undefined, // Will be in the full analysis result
        demoCodeId: updated.demoCodeId || undefined,
      });
    } catch (e) {
      console.error('[AnalysisQueue] Failed to emit completed event:', e);
    }

    // Deduct credit and log usage (consolidated to new community subscription system)
    try {
      const usageTrackingService = await getUsageTrackingService();
      // Determine analysis type based on job options
      // "Full" analysis includes mockups, breakdown report, or property research
      const jobOpts = (analysis.jobOptions || {}) as { includeMockups?: boolean; includeBreakdownReport?: boolean; includePropertyResearch?: boolean };
      const isFullAnalysis = jobOpts.includeMockups || jobOpts.includeBreakdownReport || jobOpts.includePropertyResearch;

      await usageTrackingService.logAiAnalysis(
        analysis.tenantId,
        analysis.requestedByUserId,
        analysis.id,
        isFullAnalysis ? 'full' : 'standard'
      );
    } catch (e) {
      console.error('[AnalysisQueue] Failed to track usage:', e);
      // Still continue - don't fail the analysis just because usage tracking failed
    }

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
    const updated = await storage.updateAiAnalysisStatus(analysisId, 'failed', errorMessage);

    // Emit event for timeline
    try {
      await applicationEventService.emitAiAnalysisFailed({
        applicationId: analysis.applicationId,
        tenantId: analysis.tenantId,
        userId: analysis.requestedByUserId || undefined,
        analysisId: analysis.id,
        errorMessage,
        demoCodeId: analysis.demoCodeId || undefined,
      });
    } catch (e) {
      console.error('[AnalysisQueue] Failed to emit failed event:', e);
    }

    return updated;
  }

  /**
   * Get status of a specific analysis
   */
  async getStatus(analysisId: string): Promise<{
    status: string;
    progress?: string;
    estimatedTimeSeconds?: number;
    estimatedTimeRemaining?: number;
    startedAt?: string;
    error?: string;
  }> {
    const analysis = await storage.getAiAnalysis(analysisId);

    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    const result: {
      status: string;
      progress?: string;
      estimatedTimeSeconds?: number;
      estimatedTimeRemaining?: number;
      startedAt?: string;
      error?: string;
    } = {
      status: analysis.status,
      estimatedTimeSeconds: ESTIMATED_PROCESSING_TIME,
    };

    if (analysis.status === 'queued') {
      result.progress = 'Waiting in queue...';
      result.estimatedTimeRemaining = ESTIMATED_PROCESSING_TIME;
    } else if (analysis.status === 'processing') {
      // Include startedAt so client can calculate accurate elapsed time
      if (analysis.startedAt) {
        result.startedAt = analysis.startedAt.toISOString();
      }
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
        // First, check for stale jobs that got stuck in processing
        await this.recoverStaleJobs();

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
   * Recover jobs stuck in processing state for too long
   */
  private async recoverStaleJobs(): Promise<void> {
    try {
      // Find jobs that have been processing for too long
      const staleJobs = await storage.getStaleProcessingAnalyses(MAX_PROCESSING_TIME_MS);

      for (const job of staleJobs) {
        console.warn(`[AnalysisQueue] Recovering stale job ${job.id} - was stuck in processing`);
        await this.failJob(job.id, 'Job timed out - processing took too long');
      }
    } catch (error) {
      console.error('[AnalysisQueue] Error recovering stale jobs:', error);
    }
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
