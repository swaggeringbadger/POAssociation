/**
 * Application Event Service
 *
 * Provides helper methods to emit application lifecycle events
 * for audit logging and timeline display.
 */

import { storage } from '../storage';
import type { InsertApplicationEvent } from '@shared/schema';

export class ApplicationEventService {
  /**
   * Emit event when AI analysis is queued
   */
  async emitAiAnalysisQueued(params: {
    applicationId: string;
    tenantId: string;
    userId?: string;
    analysisId: string;
    demoCodeId?: string;
  }) {
    return storage.createApplicationEvent({
      applicationId: params.applicationId,
      tenantId: params.tenantId,
      eventType: 'ai_analysis_queued',
      userId: params.userId || null,
      metadata: { analysisId: params.analysisId },
      summary: 'AI analysis queued for processing',
      relatedEntityType: 'ai_analysis',
      relatedEntityId: params.analysisId,
      demoCodeId: params.demoCodeId || null,
    });
  }

  /**
   * Emit event when AI analysis starts processing
   */
  async emitAiAnalysisStarted(params: {
    applicationId: string;
    tenantId: string;
    userId?: string;
    analysisId: string;
    demoCodeId?: string;
  }) {
    return storage.createApplicationEvent({
      applicationId: params.applicationId,
      tenantId: params.tenantId,
      eventType: 'ai_analysis_started',
      userId: params.userId || null,
      metadata: { analysisId: params.analysisId },
      summary: 'AI analysis started processing',
      relatedEntityType: 'ai_analysis',
      relatedEntityId: params.analysisId,
      demoCodeId: params.demoCodeId || null,
    });
  }

  /**
   * Emit event when AI analysis completes successfully
   */
  async emitAiAnalysisCompleted(params: {
    applicationId: string;
    tenantId: string;
    userId?: string;
    analysisId: string;
    complianceScore: number;
    riskLevel: string;
    recommendation?: string;
    demoCodeId?: string;
  }) {
    return storage.createApplicationEvent({
      applicationId: params.applicationId,
      tenantId: params.tenantId,
      eventType: 'ai_analysis_completed',
      userId: params.userId || null,
      metadata: {
        analysisId: params.analysisId,
        complianceScore: params.complianceScore,
        riskLevel: params.riskLevel,
        recommendation: params.recommendation,
      },
      summary: `AI analysis completed with ${params.complianceScore}% compliance score (${params.riskLevel} risk)`,
      relatedEntityType: 'ai_analysis',
      relatedEntityId: params.analysisId,
      demoCodeId: params.demoCodeId || null,
    });
  }

  /**
   * Emit event when AI analysis fails
   */
  async emitAiAnalysisFailed(params: {
    applicationId: string;
    tenantId: string;
    userId?: string;
    analysisId: string;
    errorMessage?: string;
    demoCodeId?: string;
  }) {
    return storage.createApplicationEvent({
      applicationId: params.applicationId,
      tenantId: params.tenantId,
      eventType: 'ai_analysis_failed',
      userId: params.userId || null,
      metadata: {
        analysisId: params.analysisId,
        errorMessage: params.errorMessage,
      },
      summary: `AI analysis failed${params.errorMessage ? `: ${params.errorMessage}` : ''}`,
      relatedEntityType: 'ai_analysis',
      relatedEntityId: params.analysisId,
      demoCodeId: params.demoCodeId || null,
    });
  }

  /**
   * Emit event for workflow actions (approve, reject, send back, etc.)
   */
  async emitWorkflowAction(params: {
    applicationId: string;
    tenantId: string;
    userId: string;
    workflowId: string;
    stepIndex: number;
    stepTitle: string;
    action: string;
    notes?: string;
    demoCodeId?: string;
  }) {
    const eventTypeMap: Record<string, string> = {
      approved: 'workflow_approved',
      rejected: 'workflow_rejected',
      conditionally_approved: 'workflow_conditionally_approved',
      sent_back: 'workflow_sent_back',
      progressed: 'workflow_step_completed',
    };

    const actionLabels: Record<string, string> = {
      approved: 'Approved',
      rejected: 'Rejected',
      conditionally_approved: 'Conditionally approved',
      sent_back: 'Sent back for changes',
      progressed: 'Progressed',
    };

    const eventType = eventTypeMap[params.action] || 'workflow_step_completed';
    const actionLabel = actionLabels[params.action] || params.action;

    return storage.createApplicationEvent({
      applicationId: params.applicationId,
      tenantId: params.tenantId,
      eventType,
      userId: params.userId,
      metadata: {
        workflowId: params.workflowId,
        stepIndex: params.stepIndex,
        stepTitle: params.stepTitle,
        action: params.action,
        notes: params.notes,
      },
      summary: `${params.stepTitle}: ${actionLabel}${params.notes ? ` - "${params.notes}"` : ''}`,
      relatedEntityType: 'workflow_step_action',
      relatedEntityId: params.workflowId,
      demoCodeId: params.demoCodeId || null,
    });
  }

  /**
   * Emit event when application is submitted
   */
  async emitApplicationSubmitted(params: {
    applicationId: string;
    tenantId: string;
    userId: string;
    applicationNumber?: string;
    projectType?: string;
    demoCodeId?: string;
  }) {
    return storage.createApplicationEvent({
      applicationId: params.applicationId,
      tenantId: params.tenantId,
      eventType: 'application_submitted',
      userId: params.userId,
      metadata: {
        applicationNumber: params.applicationNumber,
        projectType: params.projectType,
      },
      summary: `Application submitted${params.applicationNumber ? ` (#${params.applicationNumber})` : ''}`,
      relatedEntityType: 'application',
      relatedEntityId: params.applicationId,
      demoCodeId: params.demoCodeId || null,
    });
  }

  /**
   * Emit event when document is uploaded
   */
  async emitDocumentUploaded(params: {
    applicationId: string;
    tenantId: string;
    userId: string;
    documentId: string;
    fileName: string;
    fileSize?: number;
    demoCodeId?: string;
  }) {
    return storage.createApplicationEvent({
      applicationId: params.applicationId,
      tenantId: params.tenantId,
      eventType: 'document_uploaded',
      userId: params.userId,
      metadata: {
        documentId: params.documentId,
        fileName: params.fileName,
        fileSize: params.fileSize,
      },
      summary: `Document uploaded: ${params.fileName}`,
      relatedEntityType: 'document',
      relatedEntityId: params.documentId,
      demoCodeId: params.demoCodeId || null,
    });
  }

  /**
   * Emit event when comment is added
   */
  async emitCommentAdded(params: {
    applicationId: string;
    tenantId: string;
    userId: string;
    commentId: string;
    textPreview: string;
    demoCodeId?: string;
  }) {
    // Truncate text preview to 100 chars
    const preview = params.textPreview.length > 100
      ? params.textPreview.substring(0, 100) + '...'
      : params.textPreview;

    return storage.createApplicationEvent({
      applicationId: params.applicationId,
      tenantId: params.tenantId,
      eventType: 'comment_added',
      userId: params.userId,
      metadata: {
        commentId: params.commentId,
        textPreview: preview,
      },
      summary: `Comment added: "${preview}"`,
      relatedEntityType: 'comment',
      relatedEntityId: params.commentId,
      demoCodeId: params.demoCodeId || null,
    });
  }
}

export const applicationEventService = new ApplicationEventService();
