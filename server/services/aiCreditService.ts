/**
 * AI Credit Service
 *
 * Manages AI analysis credits for tenants, including:
 * - Credit balance checking with tier defaults and overrides
 * - Credit deduction after successful analysis
 * - Billing cycle reset logic
 * - Super admin override management
 */

import { storage } from '../storage';
import {
  AiAnalysisCreditCheck,
  getAiAnalysisTierDefaults,
  SubscriptionPlanType,
} from '@shared/subscriptionTypes';
import type { AiAnalysisCredits } from '@shared/schema';

export class AiCreditService {
  /**
   * Check if a tenant has credits available for AI analysis
   * Returns detailed credit status including remaining credits and overage info
   */
  async checkCredits(tenantId: string): Promise<AiAnalysisCreditCheck> {
    // Get or create credit record for tenant
    let credits = await storage.getAiAnalysisCredits(tenantId);

    if (!credits) {
      // Create default credit record based on tenant's subscription
      credits = await this.initializeCreditsForTenant(tenantId);
    }

    // Check if billing cycle needs reset
    credits = await this.checkAndResetBillingCycle(credits);

    // Calculate effective values (override or default)
    const effectiveMonthlyCredits = credits.overrideMonthlyCredits ?? credits.monthlyIncludedCredits;
    const effectiveOverageCost = credits.overrideOverageCost ?? credits.overageCostPerAnalysis;

    // Determine credit status
    const remaining = Math.max(0, effectiveMonthlyCredits - credits.creditsUsedThisMonth);
    const isOverage = credits.creditsUsedThisMonth >= effectiveMonthlyCredits;

    // Check if feature is available (has any credits or overage is allowed)
    const hasAccess = effectiveMonthlyCredits > 0 || parseFloat(effectiveOverageCost) > 0;
    const hasCredits = remaining > 0 || (isOverage && parseFloat(effectiveOverageCost) > 0);

    return {
      hasAccess,
      hasCredits,
      creditsRemaining: remaining,
      isOverage,
      overageCost: effectiveOverageCost,
      effectiveMonthlyCredits,
      effectiveOverageCost,
      reason: !hasAccess
        ? 'AI Analysis is not available on your current plan'
        : !hasCredits
          ? 'No credits remaining and overage not enabled'
          : undefined,
    };
  }

  /**
   * Deduct one credit from tenant's balance
   * Should be called after successful analysis completion
   */
  async deductCredit(tenantId: string): Promise<AiAnalysisCredits> {
    // Get current credits
    let credits = await storage.getAiAnalysisCredits(tenantId);

    if (!credits) {
      credits = await this.initializeCreditsForTenant(tenantId);
    }

    // Check billing cycle reset
    credits = await this.checkAndResetBillingCycle(credits);

    // Increment usage
    return storage.incrementAiCreditsUsed(tenantId);
  }

  /**
   * Get current credit status for display
   */
  async getCreditStatus(tenantId: string): Promise<{
    monthlyCredits: number;
    creditsUsed: number;
    creditsRemaining: number;
    isOverage: boolean;
    overageCost: string;
    hasOverride: boolean;
    overrideReason?: string;
    billingCycleStart: Date;
    daysUntilReset: number;
  }> {
    let credits = await storage.getAiAnalysisCredits(tenantId);

    if (!credits) {
      credits = await this.initializeCreditsForTenant(tenantId);
    }

    credits = await this.checkAndResetBillingCycle(credits);

    const effectiveMonthlyCredits = credits.overrideMonthlyCredits ?? credits.monthlyIncludedCredits;
    const effectiveOverageCost = credits.overrideOverageCost ?? credits.overageCostPerAnalysis;
    const remaining = Math.max(0, effectiveMonthlyCredits - credits.creditsUsedThisMonth);
    const isOverage = credits.creditsUsedThisMonth >= effectiveMonthlyCredits;

    // Calculate days until reset (assuming monthly cycle)
    const now = new Date();
    const cycleStart = new Date(credits.billingCycleStart);
    const nextReset = new Date(cycleStart);
    nextReset.setMonth(nextReset.getMonth() + 1);
    const daysUntilReset = Math.max(0, Math.ceil((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      monthlyCredits: effectiveMonthlyCredits,
      creditsUsed: credits.creditsUsedThisMonth,
      creditsRemaining: remaining,
      isOverage,
      overageCost: effectiveOverageCost,
      hasOverride: credits.overrideMonthlyCredits !== null || credits.overrideOverageCost !== null,
      overrideReason: credits.overrideReason ?? undefined,
      billingCycleStart: credits.billingCycleStart,
      daysUntilReset,
    };
  }

  /**
   * Set credit override for a tenant (super admin only)
   */
  async setOverride(
    tenantId: string,
    override: {
      monthlyCredits?: number;
      overageCost?: string;
      reason: string;
    },
    setByUserId: string
  ): Promise<AiAnalysisCredits> {
    // Ensure credits record exists
    let credits = await storage.getAiAnalysisCredits(tenantId);
    if (!credits) {
      credits = await this.initializeCreditsForTenant(tenantId);
    }

    return storage.setAiCreditsOverride(tenantId, {
      monthlyCredits: override.monthlyCredits,
      overageCost: override.overageCost,
      reason: override.reason,
      setByUserId,
    });
  }

  /**
   * Remove credit override for a tenant (super admin only)
   */
  async removeOverride(tenantId: string): Promise<AiAnalysisCredits> {
    return storage.removeAiCreditsOverride(tenantId);
  }

  /**
   * Initialize credits for a tenant based on their subscription tier
   */
  private async initializeCreditsForTenant(tenantId: string): Promise<AiAnalysisCredits> {
    // Get tenant's subscription to determine tier
    const subscription = await storage.getTenantSubscription(tenantId);

    let tierDefaults = getAiAnalysisTierDefaults('community_free');

    if (subscription?.plan?.planType) {
      tierDefaults = getAiAnalysisTierDefaults(subscription.plan.planType as SubscriptionPlanType);
    } else {
      // Check if this is a demo tenant - give them premium credits for demo purposes
      const tenant = await storage.getTenant(tenantId);
      if (tenant?.demoCodeId) {
        // Demo tenants get community_premium tier (25 credits) for testing
        tierDefaults = getAiAnalysisTierDefaults('community_premium');
        console.log('[AI Credits] Demo tenant detected, using community_premium tier:', tenantId);
      }
    }

    // Create credit record with tier defaults
    return storage.createAiAnalysisCredits({
      tenantId,
      monthlyIncludedCredits: tierDefaults.monthlyCredits,
      overageCostPerAnalysis: tierDefaults.overageCost,
      creditsUsedThisMonth: 0,
      billingCycleStart: new Date(),
    });
  }

  /**
   * Check if billing cycle should reset and reset if needed
   */
  private async checkAndResetBillingCycle(credits: AiAnalysisCredits): Promise<AiAnalysisCredits> {
    const now = new Date();
    const cycleStart = new Date(credits.billingCycleStart);

    // Check if a month has passed since cycle start
    const monthsSinceCycleStart = this.monthsDifference(cycleStart, now);

    if (monthsSinceCycleStart >= 1) {
      // Reset the billing cycle
      return storage.resetAiCreditsForBillingCycle(credits.tenantId);
    }

    return credits;
  }

  /**
   * Calculate months difference between two dates
   */
  private monthsDifference(date1: Date, date2: Date): number {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
  }

  /**
   * Update credits when tenant's subscription changes
   * Called when a tenant upgrades/downgrades their plan
   */
  async syncWithSubscription(tenantId: string): Promise<AiAnalysisCredits> {
    const subscription = await storage.getTenantSubscription(tenantId);

    if (!subscription?.plan?.planType) {
      return this.initializeCreditsForTenant(tenantId);
    }

    const tierDefaults = getAiAnalysisTierDefaults(subscription.plan.planType as SubscriptionPlanType);

    let credits = await storage.getAiAnalysisCredits(tenantId);

    if (!credits) {
      return this.initializeCreditsForTenant(tenantId);
    }

    // Update the tier defaults (but keep any overrides)
    return storage.updateAiAnalysisCredits(tenantId, {
      monthlyIncludedCredits: tierDefaults.monthlyCredits,
      overageCostPerAnalysis: tierDefaults.overageCost,
    });
  }

  /**
   * Calculate overage charges for a tenant
   * Returns the number of overage analyses and total cost
   */
  async calculateOverageCharges(tenantId: string): Promise<{
    overageCount: number;
    overageCostPerAnalysis: string;
    totalOverageCost: string;
  }> {
    const credits = await storage.getAiAnalysisCredits(tenantId);

    if (!credits) {
      return {
        overageCount: 0,
        overageCostPerAnalysis: '0',
        totalOverageCost: '0',
      };
    }

    const effectiveMonthlyCredits = credits.overrideMonthlyCredits ?? credits.monthlyIncludedCredits;
    const effectiveOverageCost = credits.overrideOverageCost ?? credits.overageCostPerAnalysis;

    const overageCount = Math.max(0, credits.creditsUsedThisMonth - effectiveMonthlyCredits);
    const totalOverageCost = (overageCount * parseFloat(effectiveOverageCost)).toFixed(2);

    return {
      overageCount,
      overageCostPerAnalysis: effectiveOverageCost,
      totalOverageCost,
    };
  }
}

// Export singleton instance
export const aiCreditService = new AiCreditService();
