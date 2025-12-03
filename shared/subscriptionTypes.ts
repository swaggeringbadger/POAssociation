/**
 * Subscription tier system types
 */

export type SubscriptionPlanType =
  // Management Company Plans
  | 'management_free'
  | 'management_starter'
  | 'management_professional'
  | 'management_enterprise'
  // Community Plans
  | 'community_free'
  | 'community_basic'
  | 'community_premium'
  | 'community_enterprise';

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'paused';

export interface SubscriptionPlan {
  id: string;
  planType: SubscriptionPlanType;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;

  // Feature limits (null = unlimited)
  maxCommunities: number | null;
  maxUsers: number | null;
  maxStorageGb: number | null;
  maxForms: number | null;
  maxApplicationsPerMonth: number | null;

  // Feature flags
  customBranding: boolean;
  aiFormGeneration: boolean;
  aiAnalysis: boolean; // AI-powered application analysis
  advancedReporting: boolean;
  apiAccess: boolean;
  customWorkflows: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  sso: boolean;
  auditLogs: boolean;

  // AI Analysis credits (per month)
  aiAnalysisMonthlyCredits: number;
  aiAnalysisOverageCost: string; // Cost per additional analysis (stored as string for precision)

  // Metadata
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  plan?: SubscriptionPlan; // Populated via join

  // Status
  status: SubscriptionStatus;

  // Billing
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  canceledAt: string | null;

  // External billing
  externalSubscriptionId: string | null;
  externalCustomerId: string | null;

  // Usage tracking
  usageCommunities: number;
  usageUsers: number;
  usageStorageGb: number;
  usageForms: number;
  usageApplicationsCurrentMonth: number;
  usageResetAt: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionHistory {
  id: string;
  tenantId: string;
  planId: string;
  plan?: SubscriptionPlan;
  status: SubscriptionStatus;

  changedByUserId: string | null;
  changeReason: string | null;

  periodStart: string;
  periodEnd: string | null;

  createdAt: string;
}

// Helper type for checking if a feature is available
export interface FeatureAccess {
  hasAccess: boolean;
  limit: number | null; // null = unlimited
  current: number;
  reason?: string; // Why access was denied
}

// Plan comparison for UI
export interface PlanComparison {
  plan: SubscriptionPlan;
  current: boolean;
  recommended: boolean;
  features: {
    name: string;
    available: boolean;
    limit?: string;
  }[];
}

// ============================================
// AI ANALYSIS CREDIT DEFAULTS BY TIER
// ============================================

/**
 * Default AI Analysis credits per subscription tier.
 * These values are used when creating/updating tenant credit records.
 * Super admins can override these per-tenant for grandfathering or special deals.
 */
export const AI_ANALYSIS_TIER_DEFAULTS: Record<SubscriptionPlanType, {
  monthlyCredits: number;
  overageCost: string;
  hasAccess: boolean;
}> = {
  // Management Company Plans
  management_free: {
    monthlyCredits: 0,
    overageCost: "0", // Not available
    hasAccess: false,
  },
  management_starter: {
    monthlyCredits: 10,
    overageCost: "4.99",
    hasAccess: true,
  },
  management_professional: {
    monthlyCredits: 50,
    overageCost: "2.99",
    hasAccess: true,
  },
  management_enterprise: {
    monthlyCredits: 200,
    overageCost: "1.49",
    hasAccess: true,
  },

  // Community Plans
  community_free: {
    monthlyCredits: 0,
    overageCost: "0",
    hasAccess: false,
  },
  community_basic: {
    monthlyCredits: 5,
    overageCost: "4.99",
    hasAccess: true,
  },
  community_premium: {
    monthlyCredits: 25,
    overageCost: "2.99",
    hasAccess: true,
  },
  community_enterprise: {
    monthlyCredits: 100,
    overageCost: "1.49",
    hasAccess: true,
  },
};

/**
 * Get AI Analysis credit defaults for a subscription plan type
 */
export function getAiAnalysisTierDefaults(planType: SubscriptionPlanType) {
  return AI_ANALYSIS_TIER_DEFAULTS[planType] || AI_ANALYSIS_TIER_DEFAULTS.community_free;
}

/**
 * AI Analysis credit check result
 */
export interface AiAnalysisCreditCheck {
  hasAccess: boolean;            // Whether AI Analysis feature is available
  hasCredits: boolean;           // Whether there are credits remaining
  remaining: number;             // Remaining credits this month
  isOverage: boolean;            // Whether using overage credits
  overageCost: string;           // Cost per additional analysis
  effectiveMonthlyCredits: number;  // Override or tier default
  effectiveOverageCost: string;     // Override or tier default
  reason?: string;               // Why access was denied
}

// ============================================
// NEW SIMPLIFIED COMMUNITY TIER SYSTEM
// ============================================

/**
 * Community tier codes based on door count
 */
export type CommunityTierCode = 'small' | 'medium' | 'large' | 'xl';

/**
 * Community tier definition
 */
export interface CommunityTierDef {
  id: string;
  tierCode: CommunityTierCode;
  name: string;
  minDoors: number;
  maxDoors: number | null; // NULL for XL (unlimited)
  basePriceMonthly: number;
  basePriceYearly: number;
  includedAiCredits: number;
  defaultOverageCost: number;
  maxUsers: number | null;
  maxStorageGb: number | null;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Community subscription with computed effective values
 */
export interface CommunitySubscriptionWithTier {
  id: string;
  communityId: string;
  tierId: string;
  tier?: CommunityTierDef;
  doorCount: number;
  status: 'active' | 'trial' | 'canceled' | 'paused';

  // Custom overrides (null = use tier default)
  customPriceMonthly: number | null;
  customPriceYearly: number | null;
  customAiCredits: number | null;
  customOverageCost: number | null;
  pricingNote: string | null;

  // Billing cycle
  billingCycleDay: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;

  // Usage
  aiCreditsUsed: number;
  applicationsThisMonth: number;

  // Computed effective values (filled by service)
  effectivePrice?: number;
  effectiveAiCredits?: number;
  effectiveOverageCost?: number;
  aiCreditsRemaining?: number;
  overageCreditsUsed?: number;
  estimatedOverageCost?: number;
}

/**
 * Per-community consumption data for dashboard
 */
export interface CommunityConsumption {
  communityId: string;
  communityName: string;
  tierCode: CommunityTierCode;
  tierName: string;
  doorCount: number;

  // Pricing
  basePrice: number;
  effectivePrice: number;
  hasCustomPricing: boolean;

  // AI Credits
  aiCreditsIncluded: number;
  aiCreditsUsed: number;
  aiCreditsRemaining: number;
  overageCredits: number;
  overageCostPerCredit: number;
  overageCost: number;

  // Usage
  applicationsThisMonth: number;

  // Billing cycle
  currentPeriodStart: string;
  currentPeriodEnd: string;
  daysUntilReset: number;
  billingCycleProgress: number; // 0-100%
}

/**
 * Aggregated consumption summary for billing entity (management company or self-managed community)
 */
export interface BillingConsumptionSummary {
  billingEntityId: string;
  billingEntityName: string;
  billingEntityType: 'management_company' | 'community';

  // Communities included in this billing
  communities: CommunityConsumption[];

  // Totals
  totalBaseCharges: number;
  totalOverageCharges: number;
  totalProjectedCharges: number;
  totalAiCreditsIncluded: number;
  totalAiCreditsUsed: number;
  totalOverageCredits: number;
  totalApplicationsThisMonth: number;

  // Period info
  currentPeriodStart: string;
  currentPeriodEnd: string;
  daysRemaining: number;
}

/**
 * Monthly usage history for charts
 */
export interface UsageHistoryMonth {
  month: string; // 'YYYY-MM'
  aiCreditsUsed: number;
  overageCredits: number;
  overageCost: number;
  applicationsSubmitted: number;
  totalCost: number;
}

/**
 * Overage projection based on current usage rate
 */
export interface OverageProjection {
  communityId: string;
  currentCreditsUsed: number;
  creditsIncluded: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyUsageRate: number;
  projectedTotalUsage: number;
  projectedOverageCredits: number;
  projectedOverageCost: number;
  willExceedLimit: boolean;
}

/**
 * Custom pricing input for super admin overrides
 */
export interface CustomPricingInput {
  customPriceMonthly?: number;
  customPriceYearly?: number;
  customAiCredits?: number;
  customOverageCost?: number;
  pricingNote?: string;
}

/**
 * Invoice status
 */
export type InvoiceStatus = 'draft' | 'finalized' | 'sent' | 'paid' | 'void';

/**
 * Default tier definitions (for reference, actual values from DB)
 */
export const COMMUNITY_TIER_DEFAULTS: Record<CommunityTierCode, {
  name: string;
  minDoors: number;
  maxDoors: number | null;
  basePriceMonthly: number;
  basePriceYearly: number;
  includedAiCredits: number;
  defaultOverageCost: number;
}> = {
  small: {
    name: 'Small Community',
    minDoors: 1,
    maxDoors: 50,
    basePriceMonthly: 29,
    basePriceYearly: 290,
    includedAiCredits: 3,
    defaultOverageCost: 4.99,
  },
  medium: {
    name: 'Medium Community',
    minDoors: 51,
    maxDoors: 150,
    basePriceMonthly: 79,
    basePriceYearly: 790,
    includedAiCredits: 5,
    defaultOverageCost: 4.99,
  },
  large: {
    name: 'Large Community',
    minDoors: 151,
    maxDoors: 500,
    basePriceMonthly: 149,
    basePriceYearly: 1490,
    includedAiCredits: 10,
    defaultOverageCost: 4.99,
  },
  xl: {
    name: 'Extra Large Community',
    minDoors: 501,
    maxDoors: null,
    basePriceMonthly: 299,
    basePriceYearly: 2990,
    includedAiCredits: 20,
    defaultOverageCost: 4.99,
  },
};

/**
 * Determine tier code based on door count
 */
export function getTierCodeByDoorCount(doorCount: number): CommunityTierCode {
  if (doorCount <= 50) return 'small';
  if (doorCount <= 150) return 'medium';
  if (doorCount <= 500) return 'large';
  return 'xl';
}

/**
 * Get tier defaults by door count
 */
export function getTierDefaultsByDoorCount(doorCount: number) {
  const tierCode = getTierCodeByDoorCount(doorCount);
  return { tierCode, ...COMMUNITY_TIER_DEFAULTS[tierCode] };
}
