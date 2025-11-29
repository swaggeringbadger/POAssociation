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
