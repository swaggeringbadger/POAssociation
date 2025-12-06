/**
 * Community Subscription Service
 *
 * Manages the new simplified 4-tier subscription system based on door count.
 * Handles tier selection, custom pricing overrides, and billing cycle management.
 */

import { db } from '../storage';
import { eq, and, lt, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import {
  CommunityTierCode,
  CommunityTierDef,
  CommunitySubscriptionWithTier,
  CustomPricingInput,
  getTierCodeByDoorCount,
  COMMUNITY_TIER_DEFAULTS,
} from '@shared/subscriptionTypes';

/**
 * Effective values computed from tier + custom overrides
 */
interface EffectiveSubscriptionValues {
  effectivePrice: number;
  effectiveCredits: number;
  effectiveOverageCost: number;
  creditsRemaining: number;
  overageCreditsUsed: number;
  estimatedOverageCost: number;
}

class CommunitySubscriptionService {
  // ==========================================
  // TIER OPERATIONS
  // ==========================================

  /**
   * Get all active tiers from the database
   */
  async getTiers(): Promise<CommunityTierDef[]> {
    const tiers = await db
      .select()
      .from(schema.communityTiers)
      .where(eq(schema.communityTiers.isActive, true))
      .orderBy(schema.communityTiers.sortOrder);

    return tiers.map(this.mapTierToInterface);
  }

  /**
   * Get tier by tier code
   */
  async getTierByCode(tierCode: CommunityTierCode): Promise<CommunityTierDef | null> {
    const [tier] = await db
      .select()
      .from(schema.communityTiers)
      .where(eq(schema.communityTiers.tierCode, tierCode))
      .limit(1);

    return tier ? this.mapTierToInterface(tier) : null;
  }

  /**
   * Get the appropriate tier for a given door count
   */
  async getTierByDoorCount(doorCount: number): Promise<CommunityTierDef> {
    const tierCode = getTierCodeByDoorCount(doorCount);
    const tier = await this.getTierByCode(tierCode);

    if (!tier) {
      // Fallback to defaults if tier not in DB
      const defaults = COMMUNITY_TIER_DEFAULTS[tierCode];
      return {
        id: tierCode,
        tierCode,
        name: defaults.name,
        minDoors: defaults.minDoors,
        maxDoors: defaults.maxDoors,
        basePriceMonthly: defaults.basePriceMonthly,
        basePriceYearly: defaults.basePriceYearly,
        includedCredits: defaults.includedCredits,
        defaultOverageCost: defaults.defaultOverageCost,
        maxUsers: null,
        maxStorageGb: null,
        isActive: true,
        sortOrder: 0,
      };
    }

    return tier;
  }

  // ==========================================
  // SUBSCRIPTION CRUD
  // ==========================================

  /**
   * Get subscription for a community
   */
  async getSubscription(communityId: string): Promise<CommunitySubscriptionWithTier | null> {
    const [subscription] = await db
      .select()
      .from(schema.communitySubscriptions)
      .where(eq(schema.communitySubscriptions.communityId, communityId))
      .limit(1);

    if (!subscription) return null;

    // Get the tier
    const tier = await this.getTierByCode(subscription.tierId as CommunityTierCode);

    const result = this.mapSubscriptionToInterface(subscription, tier || undefined);

    // Compute effective values
    const effectiveValues = this.computeEffectiveValues(result, tier || undefined);

    return {
      ...result,
      ...effectiveValues,
    };
  }

  /**
   * Get subscription with tier info joined
   */
  async getSubscriptionWithTier(communityId: string): Promise<CommunitySubscriptionWithTier | null> {
    const result = await db
      .select({
        subscription: schema.communitySubscriptions,
        tier: schema.communityTiers,
      })
      .from(schema.communitySubscriptions)
      .leftJoin(
        schema.communityTiers,
        eq(schema.communitySubscriptions.tierId, schema.communityTiers.id)
      )
      .where(eq(schema.communitySubscriptions.communityId, communityId))
      .limit(1);

    if (!result.length || !result[0].subscription) return null;

    const tier = result[0].tier ? this.mapTierToInterface(result[0].tier) : undefined;
    const sub = this.mapSubscriptionToInterface(result[0].subscription, tier);
    const effectiveValues = this.computeEffectiveValues(sub, tier);

    return { ...sub, ...effectiveValues };
  }

  /**
   * Create a subscription for a community
   */
  async createSubscription(
    communityId: string,
    doorCount: number,
    demoCodeId?: string
  ): Promise<CommunitySubscriptionWithTier> {
    // Determine tier based on door count
    const tier = await this.getTierByDoorCount(doorCount);

    // Calculate billing period (1 month from now)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const [subscription] = await db
      .insert(schema.communitySubscriptions)
      .values({
        communityId,
        tierId: tier.id,
        doorCount,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        billingCycleDay: now.getDate(),
        demoCodeId,
      })
      .returning();

    // Also update the tenant's door count
    await db
      .update(schema.tenants)
      .set({ doorCount })
      .where(eq(schema.tenants.id, communityId));

    const result = this.mapSubscriptionToInterface(subscription, tier);
    const effectiveValues = this.computeEffectiveValues(result, tier);

    return { ...result, ...effectiveValues };
  }

  /**
   * Update door count and potentially change tier
   */
  async updateDoorCount(
    communityId: string,
    newDoorCount: number
  ): Promise<CommunitySubscriptionWithTier> {
    // Get new tier based on door count
    const newTier = await this.getTierByDoorCount(newDoorCount);

    const [subscription] = await db
      .update(schema.communitySubscriptions)
      .set({
        doorCount: newDoorCount,
        tierId: newTier.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.communitySubscriptions.communityId, communityId))
      .returning();

    if (!subscription) {
      throw new Error(`No subscription found for community ${communityId}`);
    }

    // Also update the tenant's door count
    await db
      .update(schema.tenants)
      .set({ doorCount: newDoorCount })
      .where(eq(schema.tenants.id, communityId));

    const result = this.mapSubscriptionToInterface(subscription, newTier);
    const effectiveValues = this.computeEffectiveValues(result, newTier);

    return { ...result, ...effectiveValues };
  }

  // ==========================================
  // CUSTOM PRICING (Super Admin)
  // ==========================================

  /**
   * Set custom pricing overrides for a community
   */
  async setCustomPricing(
    communityId: string,
    pricing: CustomPricingInput,
    setByUserId: string
  ): Promise<CommunitySubscriptionWithTier> {
    const [subscription] = await db
      .update(schema.communitySubscriptions)
      .set({
        customPriceMonthly: pricing.customPriceMonthly?.toString() || null,
        customPriceYearly: pricing.customPriceYearly?.toString() || null,
        customCredits: pricing.customCredits || null,
        customOverageCost: pricing.customOverageCost?.toString() || null,
        pricingNote: pricing.pricingNote || null,
        pricingSetByUserId: setByUserId,
        pricingSetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.communitySubscriptions.communityId, communityId))
      .returning();

    if (!subscription) {
      throw new Error(`No subscription found for community ${communityId}`);
    }

    return this.getSubscription(communityId) as Promise<CommunitySubscriptionWithTier>;
  }

  /**
   * Clear custom pricing overrides
   */
  async clearCustomPricing(communityId: string): Promise<CommunitySubscriptionWithTier> {
    const [subscription] = await db
      .update(schema.communitySubscriptions)
      .set({
        customPriceMonthly: null,
        customPriceYearly: null,
        customCredits: null,
        customOverageCost: null,
        pricingNote: null,
        pricingSetByUserId: null,
        pricingSetAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.communitySubscriptions.communityId, communityId))
      .returning();

    if (!subscription) {
      throw new Error(`No subscription found for community ${communityId}`);
    }

    return this.getSubscription(communityId) as Promise<CommunitySubscriptionWithTier>;
  }

  // ==========================================
  // BILLING CYCLE MANAGEMENT
  // ==========================================

  /**
   * Reset billing cycle for a subscription (called at end of billing period)
   */
  async resetBillingCycle(communityId: string): Promise<void> {
    const subscription = await this.getSubscription(communityId);
    if (!subscription) {
      throw new Error(`No subscription found for community ${communityId}`);
    }

    // Calculate new period
    const now = new Date();
    const newPeriodStart = now;
    const newPeriodEnd = new Date(now);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

    await db
      .update(schema.communitySubscriptions)
      .set({
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        creditsUsed: 0,
        applicationsThisMonth: 0,
        updatedAt: new Date(),
      })
      .where(eq(schema.communitySubscriptions.communityId, communityId));
  }

  /**
   * Check and reset all expired billing cycles
   * Should be called by a cron job or startup routine
   */
  async checkAndResetExpiredCycles(): Promise<number> {
    const now = new Date();

    // Find all subscriptions with expired periods
    const expired = await db
      .select()
      .from(schema.communitySubscriptions)
      .where(
        and(
          lt(schema.communitySubscriptions.currentPeriodEnd, now),
          eq(schema.communitySubscriptions.status, 'active')
        )
      );

    let count = 0;
    for (const sub of expired) {
      await this.resetBillingCycle(sub.communityId);
      count++;
    }

    return count;
  }

  // ==========================================
  // AI CREDIT OPERATIONS
  // ==========================================

  /**
   * Check if community has AI credits available
   */
  async checkCredits(communityId: string): Promise<{
    hasCredits: boolean;
    remaining: number;
    isOverage: boolean;
    overageCost: number;
  }> {
    const subscription = await this.getSubscription(communityId);
    if (!subscription) {
      return {
        hasCredits: false,
        remaining: 0,
        isOverage: false,
        overageCost: 0,
      };
    }

    const effectiveCredits = subscription.effectiveCredits || 0;
    const used = subscription.creditsUsed;
    const remaining = Math.max(0, effectiveCredits - used);
    const isOverage = used >= effectiveCredits;
    const overageCost = subscription.effectiveOverageCost || 4.99;

    return {
      hasCredits: true, // Soft cap - always allow (but will be charged overage)
      remaining,
      isOverage,
      overageCost,
    };
  }

  /**
   * Deduct a credit (called after successful AI analysis)
   */
  async deductCredit(communityId: string): Promise<{
    newCreditsUsed: number;
    wasOverage: boolean;
    overageCost: number | null;
  }> {
    const subscription = await this.getSubscription(communityId);
    if (!subscription) {
      throw new Error(`No subscription found for community ${communityId}`);
    }

    const newCreditsUsed = subscription.creditsUsed + 1;
    const effectiveCredits = subscription.effectiveCredits || 0;
    const wasOverage = newCreditsUsed > effectiveCredits;
    const overageCost = wasOverage ? subscription.effectiveOverageCost || 4.99 : null;

    await db
      .update(schema.communitySubscriptions)
      .set({
        creditsUsed: newCreditsUsed,
        updatedAt: new Date(),
      })
      .where(eq(schema.communitySubscriptions.communityId, communityId));

    return { newCreditsUsed, wasOverage, overageCost };
  }

  /**
   * Increment application count for the month
   */
  async incrementApplicationCount(communityId: string): Promise<void> {
    await db
      .update(schema.communitySubscriptions)
      .set({
        applicationsThisMonth: sql`${schema.communitySubscriptions.applicationsThisMonth} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.communitySubscriptions.communityId, communityId));
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Compute effective values from tier + custom overrides
   */
  private computeEffectiveValues(
    subscription: CommunitySubscriptionWithTier,
    tier?: CommunityTierDef
  ): EffectiveSubscriptionValues {
    // Use custom values if set, otherwise tier defaults
    const effectivePrice = subscription.customPriceMonthly !== null
      ? subscription.customPriceMonthly
      : (tier?.basePriceMonthly || 0);

    const effectiveCredits = subscription.customCredits !== null
      ? subscription.customCredits
      : (tier?.includedCredits || 0);

    const effectiveOverageCost = subscription.customOverageCost !== null
      ? subscription.customOverageCost
      : (tier?.defaultOverageCost || 4.99);

    const creditsRemaining = Math.max(0, effectiveCredits - subscription.creditsUsed);
    const overageCreditsUsed = Math.max(0, subscription.creditsUsed - effectiveCredits);
    const estimatedOverageCost = overageCreditsUsed * effectiveOverageCost;

    return {
      effectivePrice,
      effectiveCredits,
      effectiveOverageCost,
      creditsRemaining,
      overageCreditsUsed,
      estimatedOverageCost,
    };
  }

  /**
   * Map database tier to interface
   */
  private mapTierToInterface(tier: schema.CommunityTier): CommunityTierDef {
    return {
      id: tier.id,
      tierCode: tier.tierCode as CommunityTierCode,
      name: tier.name,
      minDoors: tier.minDoors,
      maxDoors: tier.maxDoors,
      basePriceMonthly: parseFloat(tier.basePriceMonthly),
      basePriceYearly: parseFloat(tier.basePriceYearly),
      includedCredits: tier.includedCredits,
      defaultOverageCost: parseFloat(tier.defaultOverageCost),
      maxUsers: tier.maxUsers,
      maxStorageGb: tier.maxStorageGb,
      isActive: tier.isActive,
      sortOrder: tier.sortOrder,
    };
  }

  /**
   * Map database subscription to interface
   */
  private mapSubscriptionToInterface(
    sub: schema.CommunitySubscription,
    tier?: CommunityTierDef
  ): CommunitySubscriptionWithTier {
    return {
      id: sub.id,
      communityId: sub.communityId,
      tierId: sub.tierId,
      tier,
      doorCount: sub.doorCount,
      status: sub.status as 'active' | 'trial' | 'canceled' | 'paused',
      customPriceMonthly: sub.customPriceMonthly ? parseFloat(sub.customPriceMonthly) : null,
      customPriceYearly: sub.customPriceYearly ? parseFloat(sub.customPriceYearly) : null,
      customCredits: sub.customCredits,
      customOverageCost: sub.customOverageCost ? parseFloat(sub.customOverageCost) : null,
      pricingNote: sub.pricingNote,
      billingCycleDay: sub.billingCycleDay,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      creditsUsed: sub.creditsUsed,
      applicationsThisMonth: sub.applicationsThisMonth,
    };
  }
}

// Export singleton instance
export const communitySubscriptionService = new CommunitySubscriptionService();
export default communitySubscriptionService;
