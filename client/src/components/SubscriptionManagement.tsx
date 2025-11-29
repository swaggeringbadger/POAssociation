import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { SubscriptionPlan, TenantSubscription } from "@shared/subscriptionTypes";
import { SUBSCRIPTION_FEATURES } from "@shared/featureDefinitions";

// Icon component mapper
const iconMap = {
  Check,
  Sparkles,
};

export default function SubscriptionManagement() {
  const queryClient = useQueryClient();
  const { currentTenant } = useAppStore();

  // Fetch current subscription
  const { data: subscription, isLoading: loadingSubscription } = useQuery<TenantSubscription>({
    queryKey: ['tenant-subscription', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant selected');
      return api.getTenantSubscription(currentTenant.id);
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch available plans
  const { data: availablePlans, isLoading: loadingPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ['subscription-plans', currentTenant?.type],
    queryFn: async () => {
      if (!currentTenant?.type) throw new Error('No tenant type');
      return api.listSubscriptionPlans(currentTenant.type as 'management_company' | 'community');
    },
    enabled: !!currentTenant?.type,
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ planId, reason }: { planId: string; reason?: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');
      return api.updateTenantSubscription(currentTenant.id, planId, reason);
    },
    onSuccess: () => {
      toast.success('Subscription updated successfully');
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update subscription');
    },
  });

  if (loadingSubscription || loadingPlans) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription || !availablePlans) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Unable to load subscription information
      </div>
    );
  }

  const currentPlan = subscription.plan;
  if (!currentPlan) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No active subscription plan found
      </div>
    );
  }

  const isUpgrade = (plan: SubscriptionPlan) => plan.sortOrder > currentPlan.sortOrder;
  const isDowngrade = (plan: SubscriptionPlan) => plan.sortOrder < currentPlan.sortOrder;
  const isCurrent = (plan: SubscriptionPlan) => plan.id === currentPlan.id;

  const handlePlanChange = (planId: string, planName: string) => {
    const plan = availablePlans.find(p => p.id === planId);
    if (!plan) return;

    const action = isUpgrade(plan) ? 'upgrade' : 'downgrade';
    const confirmMessage = `Are you sure you want to ${action} to the ${planName} plan?`;

    if (window.confirm(confirmMessage)) {
      updateSubscriptionMutation.mutate({
        planId,
        reason: `User initiated ${action} to ${planName}`,
      });
    }
  };

  const formatUsage = (current: number | null, limit: number | null, unit: string) => {
    if (limit === null) return `${current || 0} ${unit} (Unlimited)`;
    return `${current || 0} / ${limit} ${unit}`;
  };

  const getUsagePercentage = (current: number | null, limit: number | null) => {
    if (limit === null) return 0;
    if (!current) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      trial: { label: 'Trial', variant: 'secondary' },
      active: { label: 'Active', variant: 'default' },
      past_due: { label: 'Past Due', variant: 'destructive' },
      canceled: { label: 'Canceled', variant: 'outline' },
      paused: { label: 'Paused', variant: 'secondary' },
    };
    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan: {currentPlan.name}</CardTitle>
              <CardDescription>
                {currentPlan.description || 'Your active subscription plan'}
              </CardDescription>
            </div>
            {getStatusBadge(subscription.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pricing */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              ${currentPlan.priceMonthly.toFixed(2)}
            </span>
            <span className="text-muted-foreground">/month</span>
            <span className="text-sm text-muted-foreground ml-2">
              or ${currentPlan.priceYearly.toFixed(2)}/year
            </span>
          </div>

          {/* Usage Metrics */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Usage</h3>

            {currentPlan.maxCommunities !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Communities</span>
                  <span className="text-muted-foreground">
                    {formatUsage(subscription.usageCommunities, currentPlan.maxCommunities, 'communities')}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(subscription.usageCommunities, currentPlan.maxCommunities)}
                  className="h-2"
                />
              </div>
            )}

            {currentPlan.maxUsers !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Users</span>
                  <span className="text-muted-foreground">
                    {formatUsage(subscription.usageUsers, currentPlan.maxUsers, 'users')}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(subscription.usageUsers, currentPlan.maxUsers)}
                  className="h-2"
                />
              </div>
            )}

            {currentPlan.maxStorageGb !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Storage</span>
                  <span className="text-muted-foreground">
                    {formatUsage(subscription.usageStorageGb, currentPlan.maxStorageGb, 'GB')}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(subscription.usageStorageGb, currentPlan.maxStorageGb)}
                  className="h-2"
                />
              </div>
            )}

            {currentPlan.maxForms !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Forms</span>
                  <span className="text-muted-foreground">
                    {formatUsage(subscription.usageForms, currentPlan.maxForms, 'forms')}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(subscription.usageForms, currentPlan.maxForms)}
                  className="h-2"
                />
              </div>
            )}

            {currentPlan.maxApplicationsPerMonth !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Applications (this month)</span>
                  <span className="text-muted-foreground">
                    {formatUsage(subscription.usageApplicationsCurrentMonth, currentPlan.maxApplicationsPerMonth, 'applications')}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(subscription.usageApplicationsCurrentMonth, currentPlan.maxApplicationsPerMonth)}
                  className="h-2"
                />
              </div>
            )}
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Features</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(SUBSCRIPTION_FEATURES).map(([key, feature]) => {
                // Check if this feature is enabled in the current plan
                const isEnabled = currentPlan[key as keyof SubscriptionPlan];
                if (!isEnabled) return null;

                const IconComponent = iconMap[feature.icon];
                return (
                  <div key={key} className="flex items-center gap-2 text-sm" title={feature.description}>
                    <IconComponent className={`h-4 w-4 ${feature.iconColor}`} />
                    <span>{feature.displayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billing Period */}
          {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Current billing period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
              {subscription.trialEndsAt && (
                <p className="text-sm text-muted-foreground mt-1">
                  Trial ends: {new Date(subscription.trialEndsAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {availablePlans
            .filter(plan => plan.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((plan) => (
              <Card key={plan.id} className={isCurrent(plan) ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {plan.name}
                        {isCurrent(plan) && (
                          <Badge variant="default">Current</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pricing */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      ${plan.priceMonthly.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>

                  {/* Key Limits */}
                  <div className="space-y-1 text-sm">
                    {plan.maxCommunities !== null && (
                      <p className="text-muted-foreground">
                        Up to {plan.maxCommunities} communities
                      </p>
                    )}
                    {plan.maxUsers !== null && (
                      <p className="text-muted-foreground">
                        Up to {plan.maxUsers} users
                      </p>
                    )}
                    {plan.maxStorageGb !== null && (
                      <p className="text-muted-foreground">
                        {plan.maxStorageGb} GB storage
                      </p>
                    )}
                    {plan.maxForms !== null && (
                      <p className="text-muted-foreground">
                        Up to {plan.maxForms} forms
                      </p>
                    )}
                    {plan.maxCommunities === null && plan.maxUsers === null && (
                      <p className="text-muted-foreground">Unlimited usage</p>
                    )}
                  </div>

                  {/* Key Features */}
                  <div className="space-y-1">
                    {Object.entries(SUBSCRIPTION_FEATURES)
                      .filter(([key]) => plan[key as keyof SubscriptionPlan])
                      .slice(0, 4) // Show only first 4 features
                      .map(([key, feature]) => {
                        const IconComponent = iconMap[feature.icon];
                        return (
                          <div key={key} className="flex items-center gap-2 text-sm" title={feature.description}>
                            <IconComponent className={`h-3 w-3 ${feature.iconColor}`} />
                            <span>{feature.displayName}</span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Action Button */}
                  {!isCurrent(plan) && (
                    <Button
                      className="w-full"
                      variant={isUpgrade(plan) ? 'default' : 'outline'}
                      onClick={() => handlePlanChange(plan.id, plan.name)}
                      disabled={updateSubscriptionMutation.isPending}
                    >
                      {updateSubscriptionMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          {isUpgrade(plan) ? 'Upgrade' : 'Downgrade'} to {plan.name}
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
