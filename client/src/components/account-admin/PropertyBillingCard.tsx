/**
 * PropertyBillingCard - Subscription and billing information
 *
 * Displays:
 * - Current plan name + tier badge
 * - Monthly/yearly price
 * - Next billing date
 * - Subscription status (trial/active/past_due)
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TenantSubscription, SubscriptionStatus } from "@shared/subscriptionTypes";

const statusConfig: Record<SubscriptionStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  trial: { label: "Trial", variant: "outline", className: "bg-blue-100 text-blue-800 border-blue-200" },
  active: { label: "Active", variant: "outline", className: "bg-green-100 text-green-800 border-green-200" },
  past_due: { label: "Past Due", variant: "destructive" },
  canceled: { label: "Canceled", variant: "secondary" },
  paused: { label: "Paused", variant: "secondary" },
};

const planTierColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-800 border-gray-200",
  basic: "bg-blue-100 text-blue-800 border-blue-200",
  starter: "bg-blue-100 text-blue-800 border-blue-200",
  premium: "bg-purple-100 text-purple-800 border-purple-200",
  professional: "bg-purple-100 text-purple-800 border-purple-200",
  enterprise: "bg-amber-100 text-amber-800 border-amber-200",
};

function getPlanTierColor(planName: string): string {
  const lowerName = planName.toLowerCase();
  for (const [tier, color] of Object.entries(planTierColors)) {
    if (lowerName.includes(tier)) return color;
  }
  return planTierColors.basic;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

interface PropertyBillingCardProps {
  subscription: TenantSubscription | undefined;
  isLoading?: boolean;
}

export function PropertyBillingCard({ subscription, isLoading }: PropertyBillingCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription?.plan) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center py-4">
            No billing data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const { plan, status, currentPeriodEnd, trialEndsAt } = subscription;
  const statusInfo = statusConfig[status] || statusConfig.active;
  const planTierColor = getPlanTierColor(plan.name);

  const isTrialing = status === 'trial' && trialEndsAt;
  const daysUntilRenewal = getDaysUntil(currentPeriodEnd);
  const daysUntilTrialEnd = trialEndsAt ? getDaysUntil(trialEndsAt) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Name & Status */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={cn("text-sm font-medium", planTierColor)}>
            {plan.name}
          </Badge>
          <Badge variant={statusInfo.variant} className={cn("text-xs", statusInfo.className)}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* Price */}
        <div>
          <p className="text-2xl font-bold">
            {formatCurrency(plan.priceMonthly)}
            <span className="text-sm font-normal text-muted-foreground">/month</span>
          </p>
          {plan.priceYearly > 0 && (
            <p className="text-xs text-muted-foreground">
              or {formatCurrency(plan.priceYearly)}/year (save {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%)
            </p>
          )}
        </div>

        <Separator />

        {/* Trial Warning */}
        {isTrialing && daysUntilTrialEnd !== null && (
          <div className={cn(
            "flex items-start gap-2 p-2 rounded-lg text-sm",
            daysUntilTrialEnd <= 7 ? "bg-yellow-50 text-yellow-800" : "bg-blue-50 text-blue-800"
          )}>
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">
                {daysUntilTrialEnd <= 0
                  ? "Trial ended"
                  : `${daysUntilTrialEnd} day${daysUntilTrialEnd === 1 ? '' : 's'} left in trial`
                }
              </p>
              <p className="text-xs opacity-80">
                Ends {formatDate(trialEndsAt!)}
              </p>
            </div>
          </div>
        )}

        {/* Next Billing Date */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-muted-foreground">
              {status === 'canceled' ? 'Access until' : 'Renews'}
            </p>
            <p className="font-medium">
              {formatDate(currentPeriodEnd)}
              {daysUntilRenewal > 0 && daysUntilRenewal <= 30 && (
                <span className="text-muted-foreground text-xs ml-1">
                  ({daysUntilRenewal} day{daysUntilRenewal === 1 ? '' : 's'})
                </span>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
