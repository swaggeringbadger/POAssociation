/**
 * Consumption Dashboard Service
 *
 * Aggregates billing and usage data for the account_admin dashboard.
 * Handles both management company (multi-community) and self-managed community scenarios.
 */

import { db } from '../storage';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { communitySubscriptionService } from './communitySubscriptionService';
import { usageTrackingService } from './usageTrackingService';
import {
  CommunityConsumption,
  BillingConsumptionSummary,
  UsageHistoryMonth,
  OverageProjection,
  CommunityTierCode,
} from '@shared/subscriptionTypes';

class ConsumptionDashboardService {
  // ==========================================
  // MAIN DASHBOARD DATA
  // ==========================================

  /**
   * Get full consumption summary for a billing entity (account_admin)
   *
   * The billing entity can be:
   * - A management company (sees all communities they manage)
   * - A self-managed community (sees just their own community)
   */
  async getConsumptionSummary(
    billingEntityId: string
  ): Promise<BillingConsumptionSummary> {
    // Get the billing entity (tenant)
    const [billingEntity] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, billingEntityId))
      .limit(1);

    if (!billingEntity) {
      throw new Error(`Billing entity not found: ${billingEntityId}`);
    }

    // Get communities to include based on entity type
    let communityIds: string[] = [];

    if (billingEntity.type === 'management_company') {
      // Get all communities managed by this management company
      const managedCommunities = await db
        .select()
        .from(schema.tenants)
        .where(
          and(
            eq(schema.tenants.managementCompanyId, billingEntityId),
            eq(schema.tenants.type, 'community'),
            eq(schema.tenants.isActive, true)
          )
        );
      communityIds = managedCommunities.map((c) => c.id);
    } else {
      // Self-managed community - just include itself
      communityIds = [billingEntityId];
    }

    // Get consumption data for each community
    const communities: CommunityConsumption[] = [];

    for (const communityId of communityIds) {
      const consumption = await this.getCommunityConsumption(communityId);
      if (consumption) {
        communities.push(consumption);
      }
    }

    // Calculate totals
    const totals = this.calculateTotals(communities);

    // Get period info from first community (they should all be aligned)
    const firstCommunity = communities[0];
    const now = new Date();

    return {
      billingEntityId,
      billingEntityName: billingEntity.name,
      billingEntityType: billingEntity.type as 'management_company' | 'community',
      communities,
      totalBaseCharges: totals.baseCharges,
      totalOverageCharges: totals.overageCharges,
      totalProjectedCharges: totals.baseCharges + totals.overageCharges,
      totalAiCreditsIncluded: totals.aiCreditsIncluded,
      totalAiCreditsUsed: totals.aiCreditsUsed,
      totalOverageCredits: totals.overageCredits,
      totalApplicationsThisMonth: totals.applications,
      currentPeriodStart: firstCommunity?.currentPeriodStart || now.toISOString(),
      currentPeriodEnd: firstCommunity?.currentPeriodEnd || now.toISOString(),
      daysRemaining: firstCommunity?.daysUntilReset || 0,
    };
  }

  /**
   * Get consumption data for a single community
   */
  async getCommunityConsumption(communityId: string): Promise<CommunityConsumption | null> {
    // Get community info
    const [community] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, communityId))
      .limit(1);

    if (!community) return null;

    // Get subscription with tier
    const subscription = await communitySubscriptionService.getSubscriptionWithTier(communityId);
    if (!subscription) {
      // Return placeholder for communities without subscriptions
      return this.createPlaceholderConsumption(community);
    }

    const tier = subscription.tier;

    // Calculate billing cycle progress
    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const now = new Date();

    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const billingCycleProgress = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

    // Calculate AI credits
    const aiCreditsIncluded = subscription.effectiveAiCredits || tier?.includedAiCredits || 0;
    const aiCreditsUsed = subscription.aiCreditsUsed;
    const aiCreditsRemaining = Math.max(0, aiCreditsIncluded - aiCreditsUsed);
    const overageCredits = Math.max(0, aiCreditsUsed - aiCreditsIncluded);
    const overageCostPerCredit = subscription.effectiveOverageCost || tier?.defaultOverageCost || 4.99;
    const overageCost = overageCredits * overageCostPerCredit;

    return {
      communityId,
      communityName: community.name,
      tierCode: (tier?.tierCode || 'small') as CommunityTierCode,
      tierName: tier?.name || 'Small Community',
      doorCount: subscription.doorCount,
      basePrice: tier?.basePriceMonthly || 0,
      effectivePrice: subscription.effectivePrice || tier?.basePriceMonthly || 0,
      hasCustomPricing: subscription.customPriceMonthly !== null ||
                        subscription.customAiCredits !== null ||
                        subscription.customOverageCost !== null,
      aiCreditsIncluded,
      aiCreditsUsed,
      aiCreditsRemaining,
      overageCredits,
      overageCostPerCredit,
      overageCost,
      applicationsThisMonth: subscription.applicationsThisMonth,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      daysUntilReset: daysRemaining,
      billingCycleProgress,
    };
  }

  // ==========================================
  // HISTORICAL DATA
  // ==========================================

  /**
   * Get usage history for a billing entity (for charts)
   */
  async getUsageHistory(
    billingEntityId: string,
    months: number = 6
  ): Promise<UsageHistoryMonth[]> {
    // Get the billing entity
    const [billingEntity] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, billingEntityId))
      .limit(1);

    if (!billingEntity) {
      throw new Error(`Billing entity not found: ${billingEntityId}`);
    }

    // Get communities
    let communityIds: string[] = [];

    if (billingEntity.type === 'management_company') {
      const managedCommunities = await db
        .select()
        .from(schema.tenants)
        .where(
          and(
            eq(schema.tenants.managementCompanyId, billingEntityId),
            eq(schema.tenants.type, 'community')
          )
        );
      communityIds = managedCommunities.map((c) => c.id);
    } else {
      communityIds = [billingEntityId];
    }

    // Get history for each community and aggregate
    const aggregatedHistory: Map<string, UsageHistoryMonth> = new Map();

    for (const communityId of communityIds) {
      const communityHistory = await usageTrackingService.getMonthlyUsageHistory(
        communityId,
        months
      );

      for (const month of communityHistory) {
        const existing = aggregatedHistory.get(month.month);
        if (existing) {
          existing.aiCreditsUsed += month.aiCreditsUsed;
          existing.overageCredits += month.overageCredits;
          existing.overageCost += month.overageCost;
          existing.applicationsSubmitted += month.applicationsSubmitted;
        } else {
          aggregatedHistory.set(month.month, {
            month: month.month,
            aiCreditsUsed: month.aiCreditsUsed,
            overageCredits: month.overageCredits,
            overageCost: month.overageCost,
            applicationsSubmitted: month.applicationsSubmitted,
            totalCost: 0, // Will calculate below
          });
        }
      }
    }

    // Calculate total cost for each month
    const result: UsageHistoryMonth[] = [];
    const historyData = Array.from(aggregatedHistory.values());
    for (const monthData of historyData) {
      // Get base cost from subscriptions (simplified - assumes stable pricing)
      const baseCharges = await this.getBaseCostForCommunities(communityIds);
      monthData.totalCost = baseCharges + monthData.overageCost;
      result.push(monthData);
    }

    // Sort by month ascending
    result.sort((a, b) => a.month.localeCompare(b.month));

    return result;
  }

  // ==========================================
  // PROJECTIONS
  // ==========================================

  /**
   * Get overage projection for a community based on current usage rate
   */
  async getOverageProjection(communityId: string): Promise<OverageProjection> {
    const subscription = await communitySubscriptionService.getSubscription(communityId);

    if (!subscription) {
      return {
        communityId,
        currentCreditsUsed: 0,
        creditsIncluded: 0,
        daysElapsed: 0,
        daysRemaining: 0,
        dailyUsageRate: 0,
        projectedTotalUsage: 0,
        projectedOverageCredits: 0,
        projectedOverageCost: 0,
        willExceedLimit: false,
      };
    }

    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const now = new Date();

    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const currentCreditsUsed = subscription.aiCreditsUsed;
    const creditsIncluded = subscription.effectiveAiCredits || 0;
    const dailyUsageRate = currentCreditsUsed / daysElapsed;
    const projectedTotalUsage = Math.round(dailyUsageRate * totalDays);
    const projectedOverageCredits = Math.max(0, projectedTotalUsage - creditsIncluded);
    const overageCost = subscription.effectiveOverageCost || 4.99;
    const projectedOverageCost = projectedOverageCredits * overageCost;
    const willExceedLimit = projectedTotalUsage > creditsIncluded;

    return {
      communityId,
      currentCreditsUsed,
      creditsIncluded,
      daysElapsed,
      daysRemaining,
      dailyUsageRate,
      projectedTotalUsage,
      projectedOverageCredits,
      projectedOverageCost,
      willExceedLimit,
    };
  }

  // ==========================================
  // BILLING ENTITY HELPERS
  // ==========================================

  /**
   * Get billing entity for a user with account_admin role
   * Returns the tenant where the user is account_admin
   */
  async getBillingEntityForUser(userId: string): Promise<string | null> {
    // Find tenant where user has account_admin role
    const [role] = await db
      .select()
      .from(schema.userTenantRoles)
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.role, 'account_admin')
        )
      )
      .limit(1);

    if (!role) return null;

    return role.tenantId;
  }

  /**
   * Get all communities managed by a billing entity
   */
  async getManagedCommunities(billingEntityId: string): Promise<schema.Tenant[]> {
    const [billingEntity] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, billingEntityId))
      .limit(1);

    if (!billingEntity) return [];

    if (billingEntity.type === 'management_company') {
      return db
        .select()
        .from(schema.tenants)
        .where(
          and(
            eq(schema.tenants.managementCompanyId, billingEntityId),
            eq(schema.tenants.type, 'community'),
            eq(schema.tenants.isActive, true)
          )
        );
    } else {
      // Self-managed community
      return [billingEntity];
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Calculate totals from community consumption array
   */
  private calculateTotals(communities: CommunityConsumption[]): {
    baseCharges: number;
    overageCharges: number;
    aiCreditsIncluded: number;
    aiCreditsUsed: number;
    overageCredits: number;
    applications: number;
  } {
    return communities.reduce(
      (acc, community) => ({
        baseCharges: acc.baseCharges + community.effectivePrice,
        overageCharges: acc.overageCharges + community.overageCost,
        aiCreditsIncluded: acc.aiCreditsIncluded + community.aiCreditsIncluded,
        aiCreditsUsed: acc.aiCreditsUsed + community.aiCreditsUsed,
        overageCredits: acc.overageCredits + community.overageCredits,
        applications: acc.applications + community.applicationsThisMonth,
      }),
      {
        baseCharges: 0,
        overageCharges: 0,
        aiCreditsIncluded: 0,
        aiCreditsUsed: 0,
        overageCredits: 0,
        applications: 0,
      }
    );
  }

  /**
   * Create placeholder consumption for communities without subscriptions
   */
  private createPlaceholderConsumption(community: schema.Tenant): CommunityConsumption {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return {
      communityId: community.id,
      communityName: community.name,
      tierCode: 'small' as CommunityTierCode,
      tierName: 'No Subscription',
      doorCount: community.doorCount || 0,
      basePrice: 0,
      effectivePrice: 0,
      hasCustomPricing: false,
      aiCreditsIncluded: 0,
      aiCreditsUsed: 0,
      aiCreditsRemaining: 0,
      overageCredits: 0,
      overageCostPerCredit: 0,
      overageCost: 0,
      applicationsThisMonth: 0,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      daysUntilReset: 30,
      billingCycleProgress: 0,
    };
  }

  /**
   * Get base cost for a list of communities
   */
  private async getBaseCostForCommunities(communityIds: string[]): Promise<number> {
    let totalBaseCost = 0;

    for (const communityId of communityIds) {
      const consumption = await this.getCommunityConsumption(communityId);
      if (consumption) {
        totalBaseCost += consumption.effectivePrice;
      }
    }

    return totalBaseCost;
  }
}

// Export singleton instance
export const consumptionDashboardService = new ConsumptionDashboardService();
export default consumptionDashboardService;
