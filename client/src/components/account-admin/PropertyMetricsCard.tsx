/**
 * PropertyMetricsCard - Usage metrics with color-coded progress bars
 *
 * Displays subscription usage vs limits for:
 * - Users
 * - Storage (GB)
 * - Forms
 * - Applications this month
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getUsageStatus,
  getUsagePercentage,
  formatUsageDisplay,
  getUsageWarningMessage,
  usageStatusColors,
} from "@/lib/usageStatus";
import type { TenantSubscription } from "@shared/subscriptionTypes";

interface UsageProgressBarProps {
  label: string;
  current: number;
  limit: number | null;
  unit?: string;
}

function UsageProgressBar({ label, current, limit, unit = '' }: UsageProgressBarProps) {
  const percentage = getUsagePercentage(current, limit);
  const status = getUsageStatus(percentage);
  const warningMessage = getUsageWarningMessage(status);
  const displayValue = formatUsageDisplay(current, limit, unit);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "text-muted-foreground",
            status === 'warning' && "text-yellow-600 font-medium",
            status === 'critical' && "text-red-600 font-medium"
          )}
        >
          {displayValue}
        </span>
      </div>

      {limit !== null && (
        <>
          <Progress
            value={percentage}
            className={cn(
              "h-2",
              status === 'normal' && "[&>div]:bg-green-500",
              status === 'warning' && "[&>div]:bg-yellow-500",
              status === 'critical' && "[&>div]:bg-red-500"
            )}
          />

          {warningMessage && (
            <p
              className={cn(
                "text-xs",
                status === 'warning' && "text-yellow-600",
                status === 'critical' && "text-red-600"
              )}
            >
              {warningMessage}
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface PropertyMetricsCardProps {
  subscription: TenantSubscription | undefined;
  isLoading?: boolean;
}

export function PropertyMetricsCard({ subscription, isLoading }: PropertyMetricsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!subscription?.plan) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center py-4">
            No subscription data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const { plan } = subscription;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Usage Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <UsageProgressBar
          label="Users"
          current={subscription.usageUsers}
          limit={plan.maxUsers}
          unit="users"
        />

        <UsageProgressBar
          label="Storage"
          current={Number(subscription.usageStorageGb.toFixed(2))}
          limit={plan.maxStorageGb}
          unit="GB"
        />

        <UsageProgressBar
          label="Forms"
          current={subscription.usageForms}
          limit={plan.maxForms}
          unit="forms"
        />

        <UsageProgressBar
          label="Applications (this month)"
          current={subscription.usageApplicationsCurrentMonth}
          limit={plan.maxApplicationsPerMonth}
          unit="apps"
        />
      </CardContent>
    </Card>
  );
}
