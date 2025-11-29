/**
 * Usage Status Utilities
 *
 * Color-coding system for subscription usage metrics:
 * - 0-70%: Normal (green) - healthy usage
 * - 70-90%: Warning (yellow) - approaching pay-per-use threshold
 * - 90%+: Critical (red) - at limit, may incur overage charges
 */

export type UsageStatus = 'normal' | 'warning' | 'critical';

/**
 * Get usage status based on percentage of limit used
 */
export function getUsageStatus(percentage: number): UsageStatus {
  if (percentage >= 90) return 'critical';
  if (percentage >= 70) return 'warning';
  return 'normal';
}

/**
 * Calculate usage percentage, handling unlimited (null) limits
 */
export function getUsagePercentage(current: number, limit: number | null): number {
  if (limit === null || limit === 0) return 0;
  return Math.min((current / limit) * 100, 100);
}

/**
 * Color classes for different usage statuses
 */
export const usageStatusColors = {
  normal: {
    bar: 'bg-green-500',
    text: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
  },
  warning: {
    bar: 'bg-yellow-500',
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
  },
  critical: {
    bar: 'bg-red-500',
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
  },
} as const;

/**
 * Get the CSS class for a progress bar based on usage percentage
 */
export function getProgressBarClass(percentage: number): string {
  const status = getUsageStatus(percentage);
  return usageStatusColors[status].bar;
}

/**
 * Get overall status for a property based on highest usage percentage
 * across all metered resources
 */
export function getPropertyOverallStatus(subscription: {
  usageUsers?: number;
  usageStorageGb?: number;
  usageForms?: number;
  usageApplicationsCurrentMonth?: number;
  plan?: {
    maxUsers?: number | null;
    maxStorageGb?: number | null;
    maxForms?: number | null;
    maxApplicationsPerMonth?: number | null;
  } | null;
}): UsageStatus {
  const plan = subscription?.plan;
  if (!plan) return 'normal';

  const percentages = [
    getUsagePercentage(subscription.usageUsers || 0, plan.maxUsers ?? null),
    getUsagePercentage(subscription.usageStorageGb || 0, plan.maxStorageGb ?? null),
    getUsagePercentage(subscription.usageForms || 0, plan.maxForms ?? null),
    getUsagePercentage(
      subscription.usageApplicationsCurrentMonth || 0,
      plan.maxApplicationsPerMonth ?? null
    ),
  ];

  const maxPercentage = Math.max(...percentages);
  return getUsageStatus(maxPercentage);
}

/**
 * Format a usage value with its limit for display
 */
export function formatUsageDisplay(
  current: number,
  limit: number | null,
  unit: string = ''
): string {
  const unitSuffix = unit ? ` ${unit}` : '';
  if (limit === null) {
    return `${current}${unitSuffix} (Unlimited)`;
  }
  return `${current} / ${limit}${unitSuffix}`;
}

/**
 * Get warning message for usage status
 */
export function getUsageWarningMessage(status: UsageStatus): string | null {
  switch (status) {
    case 'warning':
      return 'Approaching limit - consider upgrading plan';
    case 'critical':
      return 'At limit - additional usage may incur overage charges';
    default:
      return null;
  }
}
