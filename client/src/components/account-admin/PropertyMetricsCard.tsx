/**
 * PropertyMetricsCard - Token-based usage metrics with color-coded progress bars
 *
 * Displays subscription usage for the new token-based system:
 * - AI Credits used vs included
 * - Applications this month
 * - Overage costs (if any)
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileCheck, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunitySubscription } from "@/lib/api";

interface UsageProgressBarProps {
  label: string;
  current: number;
  limit: number | null;
  unit?: string;
  icon?: React.ReactNode;
}

function getUsageStatus(current: number, limit: number | null): 'normal' | 'warning' | 'critical' {
  if (limit === null || limit === 0) return 'normal';
  const percentage = (current / limit) * 100;
  if (percentage >= 100) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'normal';
}

function UsageProgressBar({ label, current, limit, unit = '', icon }: UsageProgressBarProps) {
  const percentage = limit ? Math.min((current / limit) * 100, 100) : 0;
  const status = getUsageStatus(current, limit);

  const displayValue = limit !== null
    ? `${current} / ${limit}${unit ? ` ${unit}` : ''}`
    : `${current}${unit ? ` ${unit}` : ''}`;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium flex items-center gap-2">
          {icon}
          {label}
        </span>
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

      {limit !== null && limit > 0 && (
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

          {status === 'warning' && (
            <p className="text-xs text-yellow-600">
              Approaching credit limit
            </p>
          )}
          {status === 'critical' && (
            <p className="text-xs text-red-600">
              Credit limit reached - overage charges may apply
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface PropertyMetricsCardProps {
  subscription: CommunitySubscription | null | undefined;
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
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
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

  const effectiveCredits = subscription.effectiveCredits ?? subscription.tier?.includedCredits ?? 0;
  const creditsUsed = subscription.creditsUsed || 0;
  const creditsRemaining = subscription.creditsRemaining ?? Math.max(0, effectiveCredits - creditsUsed);
  const overageCredits = subscription.overageCreditsUsed ?? Math.max(0, creditsUsed - effectiveCredits);
  const overageCost = subscription.estimatedOverageCost ?? 0;
  const applicationsThisMonth = subscription.applicationsThisMonth || 0;

  const tierName = subscription.tier?.name || 'Standard';
  const tierCode = subscription.tier?.tierCode || 'small';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Usage Metrics
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {tierName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Credits */}
        <UsageProgressBar
          label="AI Credits"
          current={creditsUsed}
          limit={effectiveCredits}
          unit="credits"
          icon={<Sparkles className="h-3.5 w-3.5 text-purple-500" />}
        />

        {/* Applications this month */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium flex items-center gap-2">
              <FileCheck className="h-3.5 w-3.5 text-blue-500" />
              Applications (this month)
            </span>
            <span className="text-muted-foreground">
              {applicationsThisMonth}
            </span>
          </div>
        </div>

        {/* Overage info if applicable */}
        {overageCredits > 0 && (
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="font-medium flex items-center gap-2 text-orange-600">
                <DollarSign className="h-3.5 w-3.5" />
                Overage Credits Used
              </span>
              <span className="text-orange-600 font-medium">
                {overageCredits} credits
              </span>
            </div>
            {overageCost > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                Estimated overage cost: ${overageCost.toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* Credits remaining summary */}
        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Credits Remaining</span>
            <span className={cn(
              "font-medium",
              creditsRemaining === 0 && "text-red-600",
              creditsRemaining > 0 && creditsRemaining <= effectiveCredits * 0.2 && "text-yellow-600",
              creditsRemaining > effectiveCredits * 0.2 && "text-green-600"
            )}>
              {creditsRemaining}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
