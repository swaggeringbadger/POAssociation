/**
 * AccountAdminDashboard - Main dashboard for Account Admin role
 *
 * Features:
 * - Single property: Full-width expanded layout
 * - Multiple properties: Grid of expandable tiles with summary header
 * - Accordion behavior: One tile expanded at a time
 * - Subscription-focused metrics and management
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, Users, HardDrive, FileCheck, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccountAdminSummary, usePropertySubscription, usePropertyActivity } from "@/hooks/useAccountAdminData";
import { PropertyTile } from "./PropertyTile";
import { PropertyMetricsCard } from "./PropertyMetricsCard";
import { PropertyActivityCard } from "./PropertyActivityCard";
import { PropertyBillingCard } from "./PropertyBillingCard";
import { PropertyActionsCard } from "./PropertyActionsCard";

/**
 * Stats card for summary header
 */
function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
}: {
  title: string;
  value: string;
  icon: any;
  trend: string;
  variant?: "default" | "warning" | "success";
}) {
  return (
    <Card
      className={cn(
        "shadow-sm hover:shadow-md transition-shadow",
        variant === "warning" && "border-yellow-200 bg-yellow-50/50",
        variant === "success" && "border-green-200 bg-green-50/50"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon
          className={cn(
            "h-4 w-4",
            variant === "default" && "text-muted-foreground",
            variant === "warning" && "text-yellow-600",
            variant === "success" && "text-green-600"
          )}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{trend}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Summary header for multi-property view
 */
function DashboardHeader({
  summary,
  isLoading,
}: {
  summary: {
    totalProperties: number;
    totalUsers: number;
    totalStorageGb: number;
    totalApplicationsThisMonth: number;
    propertiesAtLimit: number;
    propertiesWarning: number;
    propertiesHealthy: number;
  };
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const hasIssues = summary.propertiesAtLimit > 0 || summary.propertiesWarning > 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Account Admin Dashboard</CardTitle>
                <CardDescription className="text-indigo-100">
                  Managing {summary.totalProperties} {summary.totalProperties === 1 ? 'property' : 'properties'}
                </CardDescription>
              </div>
            </div>
            {hasIssues && (
              <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                {summary.propertiesAtLimit + summary.propertiesWarning} need attention
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Properties"
          value={summary.totalProperties.toString()}
          icon={Building}
          trend="Under your management"
        />
        <StatsCard
          title="Total Users"
          value={summary.totalUsers.toString()}
          icon={Users}
          trend="Across all properties"
        />
        <StatsCard
          title="Storage Used"
          value={`${summary.totalStorageGb.toFixed(1)} GB`}
          icon={HardDrive}
          trend="Combined storage"
        />
        <StatsCard
          title="Applications"
          value={summary.totalApplicationsThisMonth.toString()}
          icon={FileCheck}
          trend="This month"
        />
      </div>

      {/* Health Overview */}
      {summary.totalProperties > 1 && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>{summary.propertiesHealthy} healthy</span>
          </div>
          {summary.propertiesWarning > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span>{summary.propertiesWarning} approaching limits</span>
            </div>
          )}
          {summary.propertiesAtLimit > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span>{summary.propertiesAtLimit} at limit</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Single property view - expanded by default
 */
function SinglePropertyDashboard({ property }: { property: any }) {
  const { data: subscription, isLoading: subLoading } = usePropertySubscription(property.id, true);
  const { data: activity, isLoading: actLoading } = usePropertyActivity(property.id, true);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-none">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">Account Admin Dashboard</CardTitle>
              <CardDescription className="text-indigo-100">
                {property.name}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Users"
          value={(subscription?.usageUsers || 0).toString()}
          icon={Users}
          trend={subscription?.plan?.maxUsers ? `of ${subscription.plan.maxUsers} allowed` : "Unlimited"}
        />
        <StatsCard
          title="Storage Used"
          value={`${(subscription?.usageStorageGb || 0).toFixed(1)} GB`}
          icon={HardDrive}
          trend={subscription?.plan?.maxStorageGb ? `of ${subscription.plan.maxStorageGb} GB` : "Unlimited"}
        />
        <StatsCard
          title="Forms"
          value={(subscription?.usageForms || 0).toString()}
          icon={FileCheck}
          trend={subscription?.plan?.maxForms ? `of ${subscription.plan.maxForms} forms` : "Unlimited"}
        />
        <StatsCard
          title="Applications"
          value={(subscription?.usageApplicationsCurrentMonth || 0).toString()}
          icon={FileCheck}
          trend="This month"
        />
      </div>

      {/* Main Content - 7 column grid */}
      <div className="grid gap-8 md:grid-cols-7">
        <div className="col-span-4 space-y-6">
          <PropertyMetricsCard subscription={subscription} isLoading={subLoading} />
          <PropertyActivityCard
            activity={activity}
            propertyId={property.id}
            isLoading={actLoading}
          />
        </div>
        <div className="col-span-3 space-y-6">
          <PropertyBillingCard subscription={subscription} isLoading={subLoading} />
          <PropertyActionsCard property={property} />
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-property view - grid of expandable tiles
 */
function MultiPropertyDashboard({
  properties,
  summary,
  isLoading,
}: {
  properties: any[];
  summary: any;
  isLoading: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DashboardHeader summary={summary} isLoading={isLoading} />

      {/* Property Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {properties.map(property => (
          <PropertyTile
            key={property.id}
            property={property}
            isExpanded={expandedId === property.id}
            onToggle={() =>
              setExpandedId(prev => (prev === property.id ? null : property.id))
            }
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Main AccountAdminDashboard component
 */
export function AccountAdminDashboard() {
  const { summary, properties, isLoading } = useAccountAdminSummary();

  // Loading state
  if (isLoading && properties.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // No properties
  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-none">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Account Admin Dashboard</CardTitle>
                <CardDescription className="text-indigo-100">
                  No properties found
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="py-12 text-center">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Properties Assigned</h3>
            <p className="text-muted-foreground">
              You don't have account admin access to any properties yet.
              Contact your administrator to get access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Single property - show expanded view
  if (properties.length === 1) {
    return <SinglePropertyDashboard property={properties[0]} />;
  }

  // Multiple properties - show grid
  return (
    <MultiPropertyDashboard
      properties={properties}
      summary={summary}
      isLoading={isLoading}
    />
  );
}
