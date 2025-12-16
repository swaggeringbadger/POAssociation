/**
 * Account Admin Dashboard Data Hooks
 *
 * Custom hooks for fetching and managing data in the Account Admin dashboard.
 * Uses React Query for caching and lazy loading.
 *
 * Updated to use the new token-based community subscription system.
 */

import { useQuery, useQueries } from "@tanstack/react-query";
import { api, type Tenant, type Application, type CommunitySubscription } from "@/lib/api";
import { useMemo } from "react";

/**
 * Fetch all properties the current user has account_admin access to
 */
export function useAccountAdminProperties() {
  return useQuery({
    queryKey: ['account-admin', 'properties'],
    queryFn: async () => {
      const properties = await api.getManagedProperties();
      // Filter to only communities (not management companies themselves)
      return properties.filter(p => p.type === 'community');
    },
  });
}

/**
 * Fetch community subscription data for a specific property (new token-based system)
 * Only fetches when enabled=true (for lazy loading in collapsed tiles)
 */
export function usePropertySubscription(tenantId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['community-subscription', tenantId],
    queryFn: () => api.getCommunitySubscription(tenantId),
    enabled: enabled && !!tenantId,
    staleTime: 30 * 1000, // 30 seconds - subscription data changes rarely
  });
}

/**
 * Fetch application activity for a specific property
 * Only fetches when enabled=true (for lazy loading in collapsed tiles)
 */
export function usePropertyActivity(tenantId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['account-admin', 'activity', tenantId],
    queryFn: async () => {
      // Fetch applications for this tenant
      const response = await fetch(`/api/applications/list?tenantId=${tenantId}&role=account_admin&userId=current`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }
      const applications: Application[] = await response.json();

      // Sort by submitted date descending
      const sorted = applications.sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      // Get recent applications (last 5)
      const recentApplications = sorted.slice(0, 5);

      // Calculate stats
      const pendingCount = applications.filter(
        a => a.status === 'pending' || a.status === 'under_review'
      ).length;

      // Get this month's applications
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthCount = applications.filter(
        a => new Date(a.submittedAt) >= firstOfMonth
      ).length;

      return {
        recentApplications,
        totalApplications: applications.length,
        pendingCount,
        thisMonthCount,
      };
    },
    enabled: enabled && !!tenantId,
    staleTime: 60 * 1000, // 1 minute - activity data can be slightly stale
  });
}

/**
 * Summary data aggregated across all properties
 * Used for the dashboard header
 */
export function useAccountAdminSummary() {
  const { data: properties = [], isLoading: propertiesLoading } = useAccountAdminProperties();

  // Fetch community subscriptions for all properties in parallel
  const subscriptionQueries = useQueries({
    queries: properties.map(property => ({
      queryKey: ['community-subscription', property.id],
      queryFn: () => api.getCommunitySubscription(property.id),
      staleTime: 30 * 1000,
    })),
  });

  // Aggregate metrics
  const summary = useMemo(() => {
    const subscriptions = subscriptionQueries
      .filter(q => q.data)
      .map(q => q.data as CommunitySubscription);

    // Count properties by credit status
    let propertiesAtLimit = 0;
    let propertiesWarning = 0;

    subscriptions.forEach(sub => {
      const creditsRemaining = sub.creditsRemaining ?? (sub.effectiveCredits ?? 0) - sub.creditsUsed;
      const effectiveCredits = sub.effectiveCredits ?? sub.tier?.includedCredits ?? 0;

      if (effectiveCredits > 0) {
        const usagePercent = (sub.creditsUsed / effectiveCredits) * 100;
        if (usagePercent >= 100) propertiesAtLimit++;
        else if (usagePercent >= 80) propertiesWarning++;
      }
    });

    return {
      totalProperties: properties.length,
      totalCreditsUsed: subscriptions.reduce((sum, s) => sum + (s.creditsUsed || 0), 0),
      totalCreditsIncluded: subscriptions.reduce((sum, s) => sum + (s.effectiveCredits ?? s.tier?.includedCredits ?? 0), 0),
      totalApplicationsThisMonth: subscriptions.reduce(
        (sum, s) => sum + (s.applicationsThisMonth || 0),
        0
      ),
      totalOverageCost: subscriptions.reduce(
        (sum, s) => sum + (s.estimatedOverageCost ?? 0),
        0
      ),
      propertiesAtLimit,
      propertiesWarning,
      propertiesHealthy: properties.length - propertiesAtLimit - propertiesWarning,
    };
  }, [properties, subscriptionQueries]);

  const isLoading = propertiesLoading || subscriptionQueries.some(q => q.isLoading);

  return { summary, properties, isLoading };
}

/**
 * Get usage status for a property's subscription
 */
export function usePropertyUsageStatus(subscription: CommunitySubscription | null | undefined): 'normal' | 'warning' | 'critical' {
  return useMemo(() => {
    if (!subscription) return 'normal';

    const effectiveCredits = subscription.effectiveCredits ?? subscription.tier?.includedCredits ?? 0;
    if (effectiveCredits === 0) return 'normal';

    const usagePercent = (subscription.creditsUsed / effectiveCredits) * 100;
    if (usagePercent >= 100) return 'critical';
    if (usagePercent >= 80) return 'warning';
    return 'normal';
  }, [subscription]);
}

/**
 * Type for activity data returned by usePropertyActivity
 */
export interface PropertyActivity {
  recentApplications: Application[];
  totalApplications: number;
  pendingCount: number;
  thisMonthCount: number;
}

/**
 * Type for summary data returned by useAccountAdminSummary
 */
export interface AccountAdminSummary {
  totalProperties: number;
  totalCreditsUsed: number;
  totalCreditsIncluded: number;
  totalApplicationsThisMonth: number;
  totalOverageCost: number;
  propertiesAtLimit: number;
  propertiesWarning: number;
  propertiesHealthy: number;
}
