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
  advancedReporting: boolean;
  apiAccess: boolean;
  customWorkflows: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  sso: boolean;
  auditLogs: boolean;

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
