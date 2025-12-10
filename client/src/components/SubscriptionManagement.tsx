import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, Building2, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  COMMUNITY_TIER_DEFAULTS,
  getTierCodeByDoorCount,
  type CommunityTierCode,
  type CommunitySubscriptionWithTier,
  type CommunityTierDef,
} from "@shared/subscriptionTypes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// API functions for community subscriptions
async function getCommunitySubscription(communityId: string): Promise<CommunitySubscriptionWithTier | null> {
  const response = await fetch(`/api/communities/${communityId}/subscription`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Failed to fetch subscription");
  return response.json();
}

async function getSubscriptionTiers(): Promise<CommunityTierDef[]> {
  const response = await fetch("/api/subscription/tiers");
  if (!response.ok) throw new Error("Failed to fetch tiers");
  return response.json();
}

async function updateDoorCount(communityId: string, doorCount: number): Promise<CommunitySubscriptionWithTier> {
  const response = await fetch(`/api/communities/${communityId}/subscription/doors`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doorCount }),
  });
  if (!response.ok) throw new Error("Failed to update door count");
  return response.json();
}

async function createSubscription(communityId: string, doorCount: number): Promise<CommunitySubscriptionWithTier> {
  const response = await fetch(`/api/communities/${communityId}/subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doorCount }),
  });
  if (!response.ok) throw new Error("Failed to create subscription");
  return response.json();
}

export default function SubscriptionManagement() {
  const queryClient = useQueryClient();
  const { currentTenant } = useAppStore();
  const [doorCountInput, setDoorCountInput] = useState<string>("");
  const [showDoorChangeDialog, setShowDoorChangeDialog] = useState(false);

  // Fetch community subscription
  const { data: subscription, isLoading: loadingSubscription, error: subscriptionError } = useQuery({
    queryKey: ["community-subscription", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      return getCommunitySubscription(currentTenant.id);
    },
    enabled: !!currentTenant?.id && currentTenant?.type === "community",
  });

  // Fetch available tiers
  const { data: tiers = [], isLoading: loadingTiers } = useQuery({
    queryKey: ["subscription-tiers"],
    queryFn: getSubscriptionTiers,
  });

  // Update door count mutation
  const updateDoorsMutation = useMutation({
    mutationFn: async (doorCount: number) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      if (subscription) {
        return updateDoorCount(currentTenant.id, doorCount);
      } else {
        return createSubscription(currentTenant.id, doorCount);
      }
    },
    onSuccess: () => {
      toast.success("Subscription updated successfully");
      queryClient.invalidateQueries({ queryKey: ["community-subscription"] });
      setShowDoorChangeDialog(false);
      setDoorCountInput("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update subscription");
    },
  });

  // Handle management company - show different UI
  if (currentTenant?.type === "management_company") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Management Company Billing
          </CardTitle>
          <CardDescription>
            Billing for management companies is handled at the community level.
            Each community you manage has its own subscription based on door count.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            View individual community subscriptions from the Properties page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadingSubscription || loadingTiers) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No subscription yet - show setup
  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Up Subscription</CardTitle>
          <CardDescription>
            Enter your community's door count to get started with the appropriate tier.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="doorCount">Number of Doors/Units</Label>
            <Input
              id="doorCount"
              type="number"
              min={1}
              placeholder="e.g., 75"
              value={doorCountInput}
              onChange={(e) => setDoorCountInput(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Your tier and pricing is determined by the number of doors in your community.
            </p>
          </div>

          {doorCountInput && parseInt(doorCountInput) > 0 && (
            <TierPreview doorCount={parseInt(doorCountInput)} tiers={tiers} />
          )}

          <Button
            onClick={() => updateDoorsMutation.mutate(parseInt(doorCountInput))}
            disabled={!doorCountInput || parseInt(doorCountInput) < 1 || updateDoorsMutation.isPending}
          >
            {updateDoorsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              "Start Subscription"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Calculate derived values
  const currentTier = subscription.tier;
  const creditsUsed = subscription.creditsUsed || 0;
  const effectiveCredits = subscription.effectiveCredits || currentTier?.includedCredits || 0;
  const creditsRemaining = Math.max(0, effectiveCredits - creditsUsed);
  const overageCredits = Math.max(0, creditsUsed - effectiveCredits);
  const effectivePrice = subscription.effectivePrice || currentTier?.basePriceMonthly || 0;
  const effectiveOverageCost = subscription.effectiveOverageCost || currentTier?.defaultOverageCost || 2.0;
  const hasCustomPricing = subscription.customPriceMonthly !== null ||
    subscription.customAiCredits !== null ||
    subscription.customOverageCost !== null;

  // Calculate days remaining in billing period
  const periodEnd = new Date(subscription.currentPeriodEnd);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const periodStart = new Date(subscription.currentPeriodStart);
  const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = totalDays - daysRemaining;
  const billingProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

  // Calculate credit usage percentage
  const creditUsagePercent = effectiveCredits > 0 ? Math.min((creditsUsed / effectiveCredits) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      {/* Current Subscription Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {currentTier?.name || "Community Subscription"}
                {hasCustomPricing && (
                  <Badge variant="outline" className="ml-2">Custom Pricing</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {subscription.doorCount} doors • Tier based on community size
              </CardDescription>
            </div>
            <StatusBadge status={subscription.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pricing */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${effectivePrice.toFixed(2)}</span>
            <span className="text-muted-foreground">/month</span>
            {hasCustomPricing && subscription.pricingNote && (
              <span className="text-sm text-muted-foreground ml-2">
                ({subscription.pricingNote})
              </span>
            )}
          </div>

          {/* Credit Usage */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-500" />
                AI Credits
              </h3>
              <span className="text-sm text-muted-foreground">
                {creditsUsed} / {effectiveCredits} used
              </span>
            </div>

            <Progress
              value={creditUsagePercent}
              className={`h-3 ${overageCredits > 0 ? "[&>div]:bg-amber-500" : ""}`}
            />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {creditsRemaining} credits remaining
              </span>
              {overageCredits > 0 && (
                <span className="text-amber-600 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {overageCredits} overage @ ${effectiveOverageCost.toFixed(2)}/credit
                </span>
              )}
            </div>

            {overageCredits > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Estimated overage cost this period: <strong>${(overageCredits * effectiveOverageCost).toFixed(2)}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Billing Period */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Billing Period
              </h3>
              <span className="text-sm text-muted-foreground">
                {daysRemaining} days remaining
              </span>
            </div>
            <Progress value={billingProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {periodStart.toLocaleDateString()} - {periodEnd.toLocaleDateString()}
            </p>
          </div>

          {/* Applications This Month */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Applications this month</span>
            </div>
            <span className="font-semibold">{subscription.applicationsThisMonth || 0}</span>
          </div>

          {/* Change Door Count Button */}
          <Button
            variant="outline"
            onClick={() => {
              setDoorCountInput(subscription.doorCount.toString());
              setShowDoorChangeDialog(true);
            }}
          >
            Update Door Count
          </Button>
        </CardContent>
      </Card>

      {/* Tier Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Tiers</CardTitle>
          <CardDescription>
            Your tier is automatically determined by your door count. All features are included in every tier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(COMMUNITY_TIER_DEFAULTS).map(([code, tier]) => {
              const isCurrentTier = currentTier?.tierCode === code;
              return (
                <div
                  key={code}
                  className={`p-4 rounded-lg border ${isCurrentTier ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{tier.name}</h4>
                    {isCurrentTier && <Badge>Current</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {tier.minDoors}-{tier.maxDoors || "∞"} doors
                  </p>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">${tier.basePriceMonthly}</p>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </div>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <p className="text-sm flex items-center gap-1">
                      <Zap className="h-3 w-3 text-violet-500" />
                      {tier.includedCredits} credits/mo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${tier.defaultOverageCost.toFixed(2)}/credit overage
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* What Uses Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-500" />
            What Uses Credits?
          </CardTitle>
          <CardDescription>
            Credits are only used for AI-powered features. All other features are included free.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <CreditItem
              name="Standard AI Analysis"
              credits={1}
              description="AI compliance review with satellite imagery"
            />
            <CreditItem
              name="Full AI Analysis"
              credits={2}
              description="Everything in Standard + AI mockup, property research, detailed breakdown"
            />
            <CreditItem
              name="AI Form Generation"
              credits={1}
              description="Generate custom application forms from your guidelines"
            />
          </div>
        </CardContent>
      </Card>

      {/* Door Count Change Dialog */}
      <Dialog open={showDoorChangeDialog} onOpenChange={setShowDoorChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Door Count</DialogTitle>
            <DialogDescription>
              Changing your door count may move you to a different pricing tier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newDoorCount">Number of Doors</Label>
              <Input
                id="newDoorCount"
                type="number"
                min={1}
                value={doorCountInput}
                onChange={(e) => setDoorCountInput(e.target.value)}
              />
            </div>

            {doorCountInput && parseInt(doorCountInput) > 0 && (
              <TierPreview
                doorCount={parseInt(doorCountInput)}
                tiers={tiers}
                currentDoorCount={subscription.doorCount}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDoorChangeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateDoorsMutation.mutate(parseInt(doorCountInput))}
              disabled={
                !doorCountInput ||
                parseInt(doorCountInput) < 1 ||
                parseInt(doorCountInput) === subscription.doorCount ||
                updateDoorsMutation.isPending
              }
            >
              {updateDoorsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Door Count"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper Components

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    trial: { label: "Trial", variant: "secondary" },
    active: { label: "Active", variant: "default" },
    canceled: { label: "Canceled", variant: "outline" },
    paused: { label: "Paused", variant: "secondary" },
  };
  const { label, variant } = statusMap[status] || { label: status, variant: "outline" as const };
  return <Badge variant={variant}>{label}</Badge>;
}

function TierPreview({
  doorCount,
  tiers,
  currentDoorCount,
}: {
  doorCount: number;
  tiers: CommunityTierDef[];
  currentDoorCount?: number;
}) {
  const tierCode = getTierCodeByDoorCount(doorCount);
  const tier = COMMUNITY_TIER_DEFAULTS[tierCode];

  const currentTierCode = currentDoorCount ? getTierCodeByDoorCount(currentDoorCount) : null;
  const isUpgrade = currentTierCode && Object.keys(COMMUNITY_TIER_DEFAULTS).indexOf(tierCode) >
    Object.keys(COMMUNITY_TIER_DEFAULTS).indexOf(currentTierCode);
  const isDowngrade = currentTierCode && Object.keys(COMMUNITY_TIER_DEFAULTS).indexOf(tierCode) <
    Object.keys(COMMUNITY_TIER_DEFAULTS).indexOf(currentTierCode);

  return (
    <div className="p-4 rounded-lg bg-muted/50 border">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{tier.name}</span>
        {isUpgrade && <Badge variant="default">Upgrade</Badge>}
        {isDowngrade && <Badge variant="secondary">Downgrade</Badge>}
        {!isUpgrade && !isDowngrade && currentDoorCount && tierCode === currentTierCode && (
          <Badge variant="outline">Same Tier</Badge>
        )}
      </div>
      <div className="space-y-1 text-sm">
        <p>
          <strong>${tier.basePriceMonthly}</strong>/month
        </p>
        <p className="text-muted-foreground">
          {tier.includedCredits} AI credits included
        </p>
        <p className="text-muted-foreground">
          ${tier.defaultOverageCost.toFixed(2)}/credit overage
        </p>
      </div>
    </div>
  );
}

function CreditItem({
  name,
  credits,
  description,
}: {
  name: string;
  credits: number;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between p-3 rounded-lg bg-muted/50">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant="secondary" className="shrink-0 ml-4">
        {credits} {credits === 1 ? "credit" : "credits"}
      </Badge>
    </div>
  );
}
