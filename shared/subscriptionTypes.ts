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
// LEGACY PLAN-BASED CREDIT DEFAULTS (DEPRECATED)
// ============================================

/**
 * @deprecated Use COMMUNITY_TIER_DEFAULTS instead.
 * Legacy credit defaults for old subscription plan types.
 * Kept for backward compatibility during migration.
 */
export const AI_ANALYSIS_TIER_DEFAULTS: Record<SubscriptionPlanType, {
  monthlyCredits: number;
  overageCost: string;
  hasAccess: boolean;
}> = {
  // Management Company Plans - deprecated, use community tiers
  management_free: { monthlyCredits: 0, overageCost: "0", hasAccess: false },
  management_starter: { monthlyCredits: 10, overageCost: "2.00", hasAccess: true },
  management_professional: { monthlyCredits: 25, overageCost: "1.75", hasAccess: true },
  management_enterprise: { monthlyCredits: 100, overageCost: "1.25", hasAccess: true },
  // Community Plans - deprecated, use community tiers
  community_free: { monthlyCredits: 0, overageCost: "0", hasAccess: false },
  community_basic: { monthlyCredits: 10, overageCost: "2.00", hasAccess: true },
  community_premium: { monthlyCredits: 25, overageCost: "1.75", hasAccess: true },
  community_enterprise: { monthlyCredits: 100, overageCost: "1.25", hasAccess: true },
};

/**
 * @deprecated Use getTierDefaultsByDoorCount instead.
 */
export function getAiAnalysisTierDefaults(planType: SubscriptionPlanType) {
  return AI_ANALYSIS_TIER_DEFAULTS[planType] || AI_ANALYSIS_TIER_DEFAULTS.community_free;
}

/**
 * Credit check result for premium operations
 */
export interface CreditCheck {
  hasCredits: boolean;           // Whether there are credits remaining
  remaining: number;             // Remaining credits this month
  isOverage: boolean;            // Whether using overage credits
  overageCost: string;           // Cost per credit overage
  effectiveMonthlyCredits: number;  // Override or tier default
  effectiveOverageCost: string;     // Override or tier default
  reason?: string;               // Why access was denied
}

/** @deprecated Use CreditCheck instead */
export type AiAnalysisCreditCheck = CreditCheck & { hasAccess: boolean };

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
  includedCredits: number;
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
  creditsUsed: number;
  applicationsThisMonth: number;

  // Computed effective values (filled by service)
  effectivePrice?: number;
  effectiveCredits?: number;
  effectiveOverageCost?: number;
  creditsRemaining?: number;
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

  // Credits
  creditsIncluded: number;
  creditsUsed: number;
  creditsRemaining: number;
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
  totalCreditsIncluded: number;
  totalCreditsUsed: number;
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
  creditsUsed: number;
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
 * Credit costs per feature - CENTRALIZED CONSTANTS
 * Update these values to change credit costs across the entire system.
 *
 * New granular per-option pricing model:
 * - Base Analysis: 1 credit (compliance review)
 * - Satellite Imagery: +1 credit
 * - AI Mockups: +2 credits
 * - Breakdown Report: +1 credit
 * - OCR Extraction: +2 credits
 */
export const CREDIT_COSTS = {
  /** Base AI Analysis: compliance review */
  BASE_ANALYSIS: 1,

  /** Per-option add-ons */
  OPTION_SATELLITE_IMAGERY: 1,
  OPTION_AI_MOCKUPS: 2,
  OPTION_BREAKDOWN_REPORT: 1,
  OPTION_OCR_EXTRACTION: 2,

  /** @deprecated Use BASE_ANALYSIS + options instead */
  STANDARD_ANALYSIS: 2,
  /** @deprecated Use BASE_ANALYSIS + options instead */
  FULL_ANALYSIS: 4,

  /** AI Form Generation: generate custom application forms */
  AI_FORM_GENERATION: 2,

  /** AI Image Sharpening: enhance hero images using AI */
  AI_IMAGE_SHARPENING: 1,
} as const;

/**
 * Options for AI analysis credit calculation
 */
export interface AnalysisCreditOptions {
  includeSatellite?: boolean;
  includeMockups?: boolean;
  includeBreakdownReport?: boolean;
  includeOcr?: boolean;
}

/**
 * Breakdown of credits by option for tracking/reporting
 */
export interface AnalysisOptionBreakdown {
  base: number;
  satellite: number;
  mockups: number;
  breakdown: number;
  ocr: number;
  total: number;
}

/**
 * Calculate total credit cost for an AI analysis based on selected options
 */
export function calculateAnalysisCreditCost(options: AnalysisCreditOptions): number {
  let total = CREDIT_COSTS.BASE_ANALYSIS;
  if (options.includeSatellite) total += CREDIT_COSTS.OPTION_SATELLITE_IMAGERY;
  if (options.includeMockups) total += CREDIT_COSTS.OPTION_AI_MOCKUPS;
  if (options.includeBreakdownReport) total += CREDIT_COSTS.OPTION_BREAKDOWN_REPORT;
  if (options.includeOcr) total += CREDIT_COSTS.OPTION_OCR_EXTRACTION;
  return total;
}

/**
 * Get detailed breakdown of credits by option for tracking/reporting
 */
export function getAnalysisOptionBreakdown(options: AnalysisCreditOptions): AnalysisOptionBreakdown {
  const breakdown: AnalysisOptionBreakdown = {
    base: CREDIT_COSTS.BASE_ANALYSIS,
    satellite: options.includeSatellite ? CREDIT_COSTS.OPTION_SATELLITE_IMAGERY : 0,
    mockups: options.includeMockups ? CREDIT_COSTS.OPTION_AI_MOCKUPS : 0,
    breakdown: options.includeBreakdownReport ? CREDIT_COSTS.OPTION_BREAKDOWN_REPORT : 0,
    ocr: options.includeOcr ? CREDIT_COSTS.OPTION_OCR_EXTRACTION : 0,
    total: 0,
  };
  breakdown.total = breakdown.base + breakdown.satellite + breakdown.mockups + breakdown.breakdown + breakdown.ocr;
  return breakdown;
}

/**
 * Default tier definitions (for reference, actual values from DB)
 *
 * Pricing model: Everyone gets ALL features. Premium operations cost Credits.
 * - Base Analysis: 1 credit (compliance review)
 * - + Satellite Imagery: 1 credit
 * - + AI Mockups: 2 credits
 * - + Breakdown Report: 1 credit
 * - + OCR Extraction: 2 credits
 * - AI Form Generation: 2 credits
 *
 * Overage costs are tiered by community size (volume discount).
 */
export const COMMUNITY_TIER_DEFAULTS: Record<CommunityTierCode, {
  name: string;
  minDoors: number;
  maxDoors: number | null;
  basePriceMonthly: number;
  basePriceYearly: number;
  includedCredits: number;
  defaultOverageCost: number;
}> = {
  small: {
    name: 'Small Community',
    minDoors: 1,
    maxDoors: 50,
    basePriceMonthly: 29,
    basePriceYearly: 290,
    includedCredits: 10,
    defaultOverageCost: 2.00,
  },
  medium: {
    name: 'Medium Community',
    minDoors: 51,
    maxDoors: 150,
    basePriceMonthly: 79,
    basePriceYearly: 790,
    includedCredits: 25,
    defaultOverageCost: 1.75,
  },
  large: {
    name: 'Large Community',
    minDoors: 151,
    maxDoors: 500,
    basePriceMonthly: 149,
    basePriceYearly: 1490,
    includedCredits: 50,
    defaultOverageCost: 1.50,
  },
  xl: {
    name: 'Extra Large Community',
    minDoors: 501,
    maxDoors: null,
    basePriceMonthly: 299,
    basePriceYearly: 2990,
    includedCredits: 100,
    defaultOverageCost: 1.25,
  },
};

// Legacy alias for backward compatibility during migration
/** @deprecated Use includedCredits instead */
export type LegacyTierDefaults = typeof COMMUNITY_TIER_DEFAULTS & {
  [K in CommunityTierCode]: { includedAiCredits: number };
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
