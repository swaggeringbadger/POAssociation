/**
 * Usage Tracking Service
 *
 * Logs all billable events for audit and reporting.
 * Integrates with CommunitySubscriptionService for credit management.
 */

import { db } from '../storage';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { communitySubscriptionService } from './communitySubscriptionService';

export type UsageEventType =
  | 'ai_analysis'
  | 'application_submitted'
  | 'document_uploaded'
  | 'user_added'
  | 'storage_increased'
  | 'form_created';

interface UsageEventInput {
  communityId: string;
  eventType: UsageEventType;
  entityType?: string;
  entityId?: string;
  creditsUsed?: number;
  isOverage?: boolean;
  costAtTime?: number;
  metadata?: Record<string, unknown>;
  userId?: string;
}

interface LoggedUsageEvent {
  id: string;
  communityId: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  creditsUsed: number;
  isOverage: boolean;
  costAtTime: number | null;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  createdAt: string;
}

interface CreditDeductionResult {
  success: boolean;
  newCreditsUsed: number;
  wasOverage: boolean;
  overageCost: number | null;
  usageEventId: string;
}

class UsageTrackingService {
  // ==========================================
  // EVENT LOGGING
  // ==========================================

  /**
   * Log a usage event
   */
  async logEvent(input: UsageEventInput): Promise<LoggedUsageEvent> {
    // Get current billing period from subscription
    const subscription = await communitySubscriptionService.getSubscription(input.communityId);

    let billingPeriodStart: Date;
    let billingPeriodEnd: Date;

    if (subscription) {
      billingPeriodStart = new Date(subscription.currentPeriodStart);
      billingPeriodEnd = new Date(subscription.currentPeriodEnd);
    } else {
      // Default to current month if no subscription
      const now = new Date();
      billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const [event] = await db
      .insert(schema.usageEvents)
      .values({
        communityId: input.communityId,
        eventType: input.eventType,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        creditsUsed: input.creditsUsed || 0,
        isOverage: input.isOverage || false,
        costAtTime: input.costAtTime?.toString() || null,
        metadata: input.metadata || null,
        userId: input.userId || null,
        billingPeriodStart,
        billingPeriodEnd,
      })
      .returning();

    return this.mapEventToInterface(event);
  }

  /**
   * Log an AI analysis event and deduct credit
   */
  async logAiAnalysis(
    communityId: string,
    userId: string,
    analysisId: string
  ): Promise<CreditDeductionResult> {
    // Check current credit status
    const creditStatus = await communitySubscriptionService.checkCredits(communityId);

    // Deduct credit
    const deduction = await communitySubscriptionService.deductCredit(communityId);

    // Log the event
    const event = await this.logEvent({
      communityId,
      eventType: 'ai_analysis',
      entityType: 'ai_analysis',
      entityId: analysisId,
      creditsUsed: 1,
      isOverage: deduction.wasOverage,
      costAtTime: deduction.overageCost || undefined,
      metadata: {
        creditsBefore: deduction.newCreditsUsed - 1,
        creditsAfter: deduction.newCreditsUsed,
        wasOverage: deduction.wasOverage,
      },
      userId,
    });

    return {
      success: true,
      newCreditsUsed: deduction.newCreditsUsed,
      wasOverage: deduction.wasOverage,
      overageCost: deduction.overageCost,
      usageEventId: event.id,
    };
  }

  /**
   * Log an application submission event
   */
  async logApplicationSubmitted(
    communityId: string,
    applicationId: string,
    userId: string
  ): Promise<LoggedUsageEvent> {
    // Increment application count on subscription
    await communitySubscriptionService.incrementApplicationCount(communityId);

    return this.logEvent({
      communityId,
      eventType: 'application_submitted',
      entityType: 'application',
      entityId: applicationId,
      userId,
    });
  }

  /**
   * Log a document upload event
   */
  async logDocumentUploaded(
    communityId: string,
    documentId: string,
    userId: string,
    fileSize: number
  ): Promise<LoggedUsageEvent> {
    return this.logEvent({
      communityId,
      eventType: 'document_uploaded',
      entityType: 'document',
      entityId: documentId,
      metadata: { fileSize },
      userId,
    });
  }

  /**
   * Log a user added event
   */
  async logUserAdded(
    communityId: string,
    addedUserId: string,
    addedByUserId: string
  ): Promise<LoggedUsageEvent> {
    return this.logEvent({
      communityId,
      eventType: 'user_added',
      entityType: 'user',
      entityId: addedUserId,
      userId: addedByUserId,
    });
  }

  /**
   * Log a form created event
   */
  async logFormCreated(
    communityId: string,
    formId: string,
    userId: string
  ): Promise<LoggedUsageEvent> {
    return this.logEvent({
      communityId,
      eventType: 'form_created',
      entityType: 'form_template',
      entityId: formId,
      userId,
    });
  }

  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get all events for a community in a date range
   */
  async getEventsForPeriod(
    communityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LoggedUsageEvent[]> {
    const events = await db
      .select()
      .from(schema.usageEvents)
      .where(
        and(
          eq(schema.usageEvents.communityId, communityId),
          gte(schema.usageEvents.createdAt, startDate),
          lte(schema.usageEvents.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.usageEvents.createdAt));

    return events.map(this.mapEventToInterface);
  }

  /**
   * Get events for current billing period
   */
  async getEventsForCurrentPeriod(communityId: string): Promise<LoggedUsageEvent[]> {
    const subscription = await communitySubscriptionService.getSubscription(communityId);
    if (!subscription) {
      return [];
    }

    return this.getEventsForPeriod(
      communityId,
      new Date(subscription.currentPeriodStart),
      new Date(subscription.currentPeriodEnd)
    );
  }

  /**
   * Get only overage events for a period
   */
  async getOverageEventsForPeriod(
    communityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LoggedUsageEvent[]> {
    const events = await db
      .select()
      .from(schema.usageEvents)
      .where(
        and(
          eq(schema.usageEvents.communityId, communityId),
          eq(schema.usageEvents.isOverage, true),
          gte(schema.usageEvents.createdAt, startDate),
          lte(schema.usageEvents.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.usageEvents.createdAt));

    return events.map(this.mapEventToInterface);
  }

  /**
   * Get AI analysis events for a period
   */
  async getAiAnalysisEventsForPeriod(
    communityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LoggedUsageEvent[]> {
    const events = await db
      .select()
      .from(schema.usageEvents)
      .where(
        and(
          eq(schema.usageEvents.communityId, communityId),
          eq(schema.usageEvents.eventType, 'ai_analysis'),
          gte(schema.usageEvents.createdAt, startDate),
          lte(schema.usageEvents.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.usageEvents.createdAt));

    return events.map(this.mapEventToInterface);
  }

  /**
   * Get usage summary for a period
   */
  async getUsageSummary(
    communityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAiAnalyses: number;
    totalOverageCredits: number;
    totalOverageCost: number;
    totalApplications: number;
    totalDocuments: number;
    totalUsersAdded: number;
  }> {
    const events = await this.getEventsForPeriod(communityId, startDate, endDate);

    let totalAiAnalyses = 0;
    let totalOverageCredits = 0;
    let totalOverageCost = 0;
    let totalApplications = 0;
    let totalDocuments = 0;
    let totalUsersAdded = 0;

    for (const event of events) {
      switch (event.eventType) {
        case 'ai_analysis':
          totalAiAnalyses += event.creditsUsed;
          if (event.isOverage) {
            totalOverageCredits += event.creditsUsed;
            totalOverageCost += event.costAtTime || 0;
          }
          break;
        case 'application_submitted':
          totalApplications++;
          break;
        case 'document_uploaded':
          totalDocuments++;
          break;
        case 'user_added':
          totalUsersAdded++;
          break;
      }
    }

    return {
      totalAiAnalyses,
      totalOverageCredits,
      totalOverageCost,
      totalApplications,
      totalDocuments,
      totalUsersAdded,
    };
  }

  /**
   * Get monthly usage history (for charts)
   */
  async getMonthlyUsageHistory(
    communityId: string,
    months: number = 6
  ): Promise<
    {
      month: string;
      creditsUsed: number;
      overageCredits: number;
      overageCost: number;
      applicationsSubmitted: number;
    }[]
  > {
    const result: {
      month: string;
      creditsUsed: number;
      overageCredits: number;
      overageCost: number;
      applicationsSubmitted: number;
    }[] = [];

    const now = new Date();

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

      const summary = await this.getUsageSummary(communityId, monthStart, monthEnd);

      result.push({
        month: monthKey,
        creditsUsed: summary.totalAiAnalyses,
        overageCredits: summary.totalOverageCredits,
        overageCost: summary.totalOverageCost,
        applicationsSubmitted: summary.totalApplications,
      });
    }

    // Reverse to show oldest first
    return result.reverse();
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Map database event to interface
   */
  private mapEventToInterface(event: schema.UsageEvent): LoggedUsageEvent {
    return {
      id: event.id,
      communityId: event.communityId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      creditsUsed: event.creditsUsed || 0,
      isOverage: event.isOverage || false,
      costAtTime: event.costAtTime ? parseFloat(event.costAtTime) : null,
      metadata: event.metadata as Record<string, unknown> | null,
      userId: event.userId,
      billingPeriodStart: event.billingPeriodStart.toISOString(),
      billingPeriodEnd: event.billingPeriodEnd.toISOString(),
      createdAt: event.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const usageTrackingService = new UsageTrackingService();
export default usageTrackingService;
