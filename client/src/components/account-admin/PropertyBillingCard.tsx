/**
 * PropertyBillingCard - Subscription and billing information
 *
 * Displays for the new token-based system:
 * - Current tier (Small/Medium/Large/XL)
 * - Monthly price (effective, with custom if applicable)
 * - Included AI credits
 * - Next billing date
 * - Subscription status
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Calendar, Sparkles, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunitySubscription } from "@/lib/api";

type SubscriptionStatus = 'active' | 'trial' | 'canceled' | 'paused';

const statusConfig: Record<SubscriptionStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  trial: { label: "Trial", variant: "outline", className: "bg-blue-100 text-blue-800 border-blue-200" },
  active: { label: "Active", variant: "outline", className: "bg-green-100 text-green-800 border-green-200" },
  canceled: { label: "Canceled", variant: "secondary" },
  paused: { label: "Paused", variant: "secondary" },
};

const tierColors: Record<string, string> = {
  small: "bg-gray-100 text-gray-800 border-gray-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  large: "bg-purple-100 text-purple-800 border-purple-200",
  xl: "bg-amber-100 text-amber-800 border-amber-200",
};

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
  subscription: CommunitySubscription | null | undefined;
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

  if (!subscription) {
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

  const status = subscription.status as SubscriptionStatus;
  const statusInfo = statusConfig[status] || statusConfig.active;
  const tierCode = subscription.tier?.tierCode || 'small';
  const tierName = subscription.tier?.name || 'Standard';
  const tierColor = tierColors[tierCode] || tierColors.small;

  const effectivePrice = subscription.effectivePrice ?? subscription.tier?.basePriceMonthly ?? 0;
  const hasCustomPricing = subscription.customPriceMonthly !== null;
  const includedCredits = subscription.effectiveCredits ?? subscription.tier?.includedCredits ?? 0;
  const doorCount = subscription.doorCount || 0;

  const daysUntilRenewal = getDaysUntil(subscription.currentPeriodEnd);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier & Status */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={cn("text-sm font-medium", tierColor)}>
            {tierName}
          </Badge>
          <Badge variant={statusInfo.variant} className={cn("text-xs", statusInfo.className)}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* Door Count */}
        <div className="flex items-center gap-2 text-sm">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Doors:</span>
          <span className="font-medium">{doorCount}</span>
        </div>

        {/* Price */}
        <div>
          <p className="text-2xl font-bold">
            {formatCurrency(effectivePrice)}
            <span className="text-sm font-normal text-muted-foreground">/month</span>
          </p>
          {hasCustomPricing && (
            <p className="text-xs text-blue-600">
              Custom pricing applied
            </p>
          )}
        </div>

        <Separator />

        {/* Included Credits */}
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-muted-foreground">Included AI Credits:</span>
          <span className="font-medium">{includedCredits}/month</span>
        </div>

        {/* Next Billing Date */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-muted-foreground">
              {status === 'canceled' ? 'Access until' : 'Renews'}
            </p>
            <p className="font-medium">
              {formatDate(subscription.currentPeriodEnd)}
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
