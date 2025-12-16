/**
 * PropertyTile - Expandable property tile with metrics and actions
 *
 * Features:
 * - Collapsed view: Property name, subdomain, status, mini usage indicator
 * - Expanded view: Metrics, Activity, Billing/Actions cards
 * - Accordion behavior: Controlled by parent
 * - Color-coded border for warning/critical status
 * - Lazy loads detailed data when expanded
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePropertySubscription, usePropertyActivity, usePropertyUsageStatus } from "@/hooks/useAccountAdminData";
import { PropertyMetricsCard } from "./PropertyMetricsCard";
import { PropertyActivityCard } from "./PropertyActivityCard";
import { PropertyBillingCard } from "./PropertyBillingCard";
import { PropertyActionsCard } from "./PropertyActionsCard";
import type { Tenant } from "@/lib/api";

type UsageStatus = 'normal' | 'warning' | 'critical';

interface PropertyTileProps {
  property: Tenant;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Mini indicator dot for collapsed tiles with warnings
 */
function MiniUsageIndicator({ status }: { status: UsageStatus }) {
  if (status === 'normal') return null;

  return (
    <div
      className={cn(
        "h-2.5 w-2.5 rounded-full",
        status === 'warning' && "bg-yellow-500",
        status === 'critical' && "bg-red-500 animate-pulse"
      )}
      title={status === 'critical' ? 'Credit limit reached' : 'Approaching credit limit'}
    />
  );
}

export function PropertyTile({ property, isExpanded, onToggle }: PropertyTileProps) {
  // Only fetch detailed data when expanded (performance optimization)
  const { data: subscription, isLoading: subLoading } = usePropertySubscription(
    property.id,
    isExpanded
  );
  const { data: activity, isLoading: actLoading } = usePropertyActivity(
    property.id,
    isExpanded
  );

  // Get overall status for border color indicator
  const overallStatus = usePropertyUsageStatus(subscription);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggle}
      className={cn(isExpanded && "md:col-span-2 xl:col-span-3")}
    >
      <Card
        className={cn(
          "transition-all duration-200",
          isExpanded && "ring-2 ring-primary shadow-lg",
          !isExpanded && overallStatus === 'warning' && "border-l-4 border-l-yellow-500",
          !isExpanded && overallStatus === 'critical' && "border-l-4 border-l-red-500"
        )}
      >
        {/* Collapsed Header - Always visible */}
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    overallStatus === 'normal' && "bg-primary/10",
                    overallStatus === 'warning' && "bg-yellow-100",
                    overallStatus === 'critical' && "bg-red-100"
                  )}
                >
                  <Building
                    className={cn(
                      "h-5 w-5",
                      overallStatus === 'normal' && "text-primary",
                      overallStatus === 'warning' && "text-yellow-600",
                      overallStatus === 'critical' && "text-red-600"
                    )}
                  />
                </div>
                <div>
                  <CardTitle className="text-lg">{property.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs font-mono">
                      {property.subdomain}
                    </Badge>
                    <Badge variant={property.isActive ? "default" : "secondary"}>
                      {property.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Mini usage indicator in collapsed view */}
                {!isExpanded && <MiniUsageIndicator status={overallStatus} />}
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid gap-6 pt-4 border-t grid-cols-1 lg:grid-cols-3">
              {/* Usage Metrics */}
              <PropertyMetricsCard subscription={subscription} isLoading={subLoading} />

              {/* Recent Activity */}
              <PropertyActivityCard
                activity={activity}
                propertyId={property.id}
                isLoading={actLoading}
              />

              {/* Billing & Actions */}
              <div className="space-y-4">
                <PropertyBillingCard subscription={subscription} isLoading={subLoading} />
                <PropertyActionsCard property={property} />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
