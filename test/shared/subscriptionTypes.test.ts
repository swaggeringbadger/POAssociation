import { describe, it, expect } from 'vitest';
import {
  AI_ANALYSIS_TIER_DEFAULTS,
  getAiAnalysisTierDefaults,
  COMMUNITY_TIER_DEFAULTS,
  getTierCodeByDoorCount,
  getTierDefaultsByDoorCount,
  type SubscriptionPlanType,
  type CommunityTierCode,
} from '../../shared/subscriptionTypes';

/**
 * Subscription Types Tests
 *
 * Tests for subscription tier system from recent billing commits:
 * - AI analysis tier defaults
 * - Community tier determination based on door count
 * - Pricing tier calculations
 */

describe('Subscription Types', () => {
  describe('AI_ANALYSIS_TIER_DEFAULTS', () => {
    it('should have defaults for all subscription plan types', () => {
      const planTypes: SubscriptionPlanType[] = [
        'management_free',
        'management_starter',
        'management_professional',
        'management_enterprise',
        'community_free',
        'community_basic',
        'community_premium',
        'community_enterprise',
      ];

      planTypes.forEach(planType => {
        expect(AI_ANALYSIS_TIER_DEFAULTS[planType]).toBeDefined();
        expect(AI_ANALYSIS_TIER_DEFAULTS[planType].monthlyCredits).toBeDefined();
        expect(AI_ANALYSIS_TIER_DEFAULTS[planType].overageCost).toBeDefined();
        expect(AI_ANALYSIS_TIER_DEFAULTS[planType].hasAccess).toBeDefined();
      });
    });

    it('should deny AI access for free tiers', () => {
      expect(AI_ANALYSIS_TIER_DEFAULTS.management_free.hasAccess).toBe(false);
      expect(AI_ANALYSIS_TIER_DEFAULTS.management_free.monthlyCredits).toBe(0);
      expect(AI_ANALYSIS_TIER_DEFAULTS.community_free.hasAccess).toBe(false);
      expect(AI_ANALYSIS_TIER_DEFAULTS.community_free.monthlyCredits).toBe(0);
    });

    it('should grant AI access for paid tiers', () => {
      expect(AI_ANALYSIS_TIER_DEFAULTS.management_starter.hasAccess).toBe(true);
      expect(AI_ANALYSIS_TIER_DEFAULTS.management_starter.monthlyCredits).toBe(10);

      expect(AI_ANALYSIS_TIER_DEFAULTS.community_basic.hasAccess).toBe(true);
      expect(AI_ANALYSIS_TIER_DEFAULTS.community_basic.monthlyCredits).toBe(10);
    });

    it('should have increasing credits for higher tiers', () => {
      const managementTiers = [
        AI_ANALYSIS_TIER_DEFAULTS.management_starter.monthlyCredits,
        AI_ANALYSIS_TIER_DEFAULTS.management_professional.monthlyCredits,
        AI_ANALYSIS_TIER_DEFAULTS.management_enterprise.monthlyCredits,
      ];

      // Each tier should have more or equal credits than the previous
      for (let i = 1; i < managementTiers.length; i++) {
        expect(managementTiers[i]).toBeGreaterThanOrEqual(managementTiers[i - 1]);
      }
    });

    it('should have decreasing overage costs for higher tiers', () => {
      const managementOverage = [
        parseFloat(AI_ANALYSIS_TIER_DEFAULTS.management_starter.overageCost),
        parseFloat(AI_ANALYSIS_TIER_DEFAULTS.management_professional.overageCost),
        parseFloat(AI_ANALYSIS_TIER_DEFAULTS.management_enterprise.overageCost),
      ];

      // Each tier should have lower or equal overage cost (volume discount)
      for (let i = 1; i < managementOverage.length; i++) {
        expect(managementOverage[i]).toBeLessThanOrEqual(managementOverage[i - 1]);
      }
    });
  });

  describe('getAiAnalysisTierDefaults', () => {
    it('should return correct defaults for each plan type', () => {
      expect(getAiAnalysisTierDefaults('community_premium')).toEqual({
        monthlyCredits: 25,
        overageCost: '1.75',
        hasAccess: true,
      });

      expect(getAiAnalysisTierDefaults('management_enterprise')).toEqual({
        monthlyCredits: 100,
        overageCost: '1.25',
        hasAccess: true,
      });
    });

    it('should return community_free defaults for unknown plan type', () => {
      const result = getAiAnalysisTierDefaults('unknown_plan' as SubscriptionPlanType);
      expect(result).toEqual(AI_ANALYSIS_TIER_DEFAULTS.community_free);
    });
  });

  describe('COMMUNITY_TIER_DEFAULTS', () => {
    it('should have all tier codes defined', () => {
      const tierCodes: CommunityTierCode[] = ['small', 'medium', 'large', 'xl'];

      tierCodes.forEach(code => {
        expect(COMMUNITY_TIER_DEFAULTS[code]).toBeDefined();
        expect(COMMUNITY_TIER_DEFAULTS[code].name).toBeDefined();
        expect(COMMUNITY_TIER_DEFAULTS[code].minDoors).toBeDefined();
        expect(COMMUNITY_TIER_DEFAULTS[code].basePriceMonthly).toBeDefined();
        expect(COMMUNITY_TIER_DEFAULTS[code].basePriceYearly).toBeDefined();
        expect(COMMUNITY_TIER_DEFAULTS[code].includedCredits).toBeDefined();
        expect(COMMUNITY_TIER_DEFAULTS[code].defaultOverageCost).toBeDefined();
      });
    });

    it('should have non-overlapping door ranges', () => {
      expect(COMMUNITY_TIER_DEFAULTS.small.maxDoors).toBe(50);
      expect(COMMUNITY_TIER_DEFAULTS.medium.minDoors).toBe(51);
      expect(COMMUNITY_TIER_DEFAULTS.medium.maxDoors).toBe(150);
      expect(COMMUNITY_TIER_DEFAULTS.large.minDoors).toBe(151);
      expect(COMMUNITY_TIER_DEFAULTS.large.maxDoors).toBe(500);
      expect(COMMUNITY_TIER_DEFAULTS.xl.minDoors).toBe(501);
      expect(COMMUNITY_TIER_DEFAULTS.xl.maxDoors).toBeNull(); // Unlimited
    });

    it('should have increasing prices for larger tiers', () => {
      const prices = [
        COMMUNITY_TIER_DEFAULTS.small.basePriceMonthly,
        COMMUNITY_TIER_DEFAULTS.medium.basePriceMonthly,
        COMMUNITY_TIER_DEFAULTS.large.basePriceMonthly,
        COMMUNITY_TIER_DEFAULTS.xl.basePriceMonthly,
      ];

      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThan(prices[i - 1]);
      }
    });

    it('should have increasing credits for larger tiers', () => {
      const credits = [
        COMMUNITY_TIER_DEFAULTS.small.includedCredits,
        COMMUNITY_TIER_DEFAULTS.medium.includedCredits,
        COMMUNITY_TIER_DEFAULTS.large.includedCredits,
        COMMUNITY_TIER_DEFAULTS.xl.includedCredits,
      ];

      for (let i = 1; i < credits.length; i++) {
        expect(credits[i]).toBeGreaterThan(credits[i - 1]);
      }
    });

    it('should have decreasing overage costs for larger tiers (volume discount)', () => {
      const overageCosts = [
        COMMUNITY_TIER_DEFAULTS.small.defaultOverageCost,
        COMMUNITY_TIER_DEFAULTS.medium.defaultOverageCost,
        COMMUNITY_TIER_DEFAULTS.large.defaultOverageCost,
        COMMUNITY_TIER_DEFAULTS.xl.defaultOverageCost,
      ];

      for (let i = 1; i < overageCosts.length; i++) {
        expect(overageCosts[i]).toBeLessThan(overageCosts[i - 1]);
      }
    });

    it('should have yearly price roughly 10x monthly (discount)', () => {
      const tiers: CommunityTierCode[] = ['small', 'medium', 'large', 'xl'];

      tiers.forEach(tier => {
        const monthlyTotal = COMMUNITY_TIER_DEFAULTS[tier].basePriceMonthly * 12;
        const yearly = COMMUNITY_TIER_DEFAULTS[tier].basePriceYearly;
        // Yearly should be less than 12 months (discount)
        expect(yearly).toBeLessThan(monthlyTotal);
        // But roughly in the same ballpark (10 months worth)
        expect(yearly).toBeGreaterThan(monthlyTotal * 0.7);
      });
    });
  });

  describe('getTierCodeByDoorCount', () => {
    it('should return "small" for 1-50 doors', () => {
      expect(getTierCodeByDoorCount(1)).toBe('small');
      expect(getTierCodeByDoorCount(25)).toBe('small');
      expect(getTierCodeByDoorCount(50)).toBe('small');
    });

    it('should return "medium" for 51-150 doors', () => {
      expect(getTierCodeByDoorCount(51)).toBe('medium');
      expect(getTierCodeByDoorCount(100)).toBe('medium');
      expect(getTierCodeByDoorCount(150)).toBe('medium');
    });

    it('should return "large" for 151-500 doors', () => {
      expect(getTierCodeByDoorCount(151)).toBe('large');
      expect(getTierCodeByDoorCount(300)).toBe('large');
      expect(getTierCodeByDoorCount(500)).toBe('large');
    });

    it('should return "xl" for 501+ doors', () => {
      expect(getTierCodeByDoorCount(501)).toBe('xl');
      expect(getTierCodeByDoorCount(1000)).toBe('xl');
      expect(getTierCodeByDoorCount(10000)).toBe('xl');
    });

    it('should handle boundary values correctly', () => {
      expect(getTierCodeByDoorCount(50)).toBe('small');
      expect(getTierCodeByDoorCount(51)).toBe('medium');
      expect(getTierCodeByDoorCount(150)).toBe('medium');
      expect(getTierCodeByDoorCount(151)).toBe('large');
      expect(getTierCodeByDoorCount(500)).toBe('large');
      expect(getTierCodeByDoorCount(501)).toBe('xl');
    });
  });

  describe('getTierDefaultsByDoorCount', () => {
    it('should return tier defaults with tier code for small community', () => {
      const result = getTierDefaultsByDoorCount(30);

      expect(result.tierCode).toBe('small');
      expect(result.name).toBe('Small Community');
      expect(result.minDoors).toBe(1);
      expect(result.maxDoors).toBe(50);
      expect(result.basePriceMonthly).toBe(29);
      expect(result.includedCredits).toBe(10);
    });

    it('should return tier defaults with tier code for medium community', () => {
      const result = getTierDefaultsByDoorCount(100);

      expect(result.tierCode).toBe('medium');
      expect(result.name).toBe('Medium Community');
      expect(result.minDoors).toBe(51);
      expect(result.maxDoors).toBe(150);
      expect(result.basePriceMonthly).toBe(79);
      expect(result.includedCredits).toBe(25);
    });

    it('should return tier defaults with tier code for large community', () => {
      const result = getTierDefaultsByDoorCount(300);

      expect(result.tierCode).toBe('large');
      expect(result.name).toBe('Large Community');
      expect(result.basePriceMonthly).toBe(149);
      expect(result.includedCredits).toBe(50);
    });

    it('should return tier defaults with tier code for xl community', () => {
      const result = getTierDefaultsByDoorCount(1000);

      expect(result.tierCode).toBe('xl');
      expect(result.name).toBe('Extra Large Community');
      expect(result.maxDoors).toBeNull();
      expect(result.basePriceMonthly).toBe(299);
      expect(result.includedCredits).toBe(100);
    });

    it('should include all expected properties', () => {
      const result = getTierDefaultsByDoorCount(50);

      expect(result).toHaveProperty('tierCode');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('minDoors');
      expect(result).toHaveProperty('maxDoors');
      expect(result).toHaveProperty('basePriceMonthly');
      expect(result).toHaveProperty('basePriceYearly');
      expect(result).toHaveProperty('includedCredits');
      expect(result).toHaveProperty('defaultOverageCost');
    });
  });
});
