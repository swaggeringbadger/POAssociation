/**
 * PropertyActivityCard - Recent application activity
 *
 * Displays:
 * - Recent applications (last 5) with status badges
 * - Pending review count
 * - Applications this month total
 * - Quick link to view all applications
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Activity, Clock, FileCheck, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { PropertyActivity } from "@/hooks/useAccountAdminData";

const statusBadgeVariants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  pending: { variant: "default" },
  under_review: { variant: "secondary" },
  approved: { variant: "outline", className: "bg-green-100 text-green-800 border-green-200" },
  rejected: { variant: "destructive" },
  draft: { variant: "outline" },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface PropertyActivityCardProps {
  activity: PropertyActivity | undefined;
  propertyId: string;
  isLoading?: boolean;
}

export function PropertyActivityCard({ activity, propertyId, isLoading }: PropertyActivityCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!activity) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const { recentApplications, pendingCount, thisMonthCount, totalApplications } = activity;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Clock className="h-4 w-4 text-yellow-600" />
            <div>
              <p className="text-lg font-semibold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending Review</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <FileCheck className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-lg font-semibold">{thisMonthCount}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Recent Applications */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Recent Applications
          </p>
          {recentApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No applications yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentApplications.map((app) => {
                const badgeConfig = statusBadgeVariants[app.status] || { variant: "outline" as const };
                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <span className="text-muted-foreground truncate max-w-[60%]">
                      {formatDate(app.submittedAt)}
                    </span>
                    <Badge
                      variant={badgeConfig.variant}
                      className={cn("text-xs", badgeConfig.className)}
                    >
                      {formatStatus(app.status)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* View All Link */}
        {totalApplications > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            asChild
          >
            <Link href={`/applications?tenant=${propertyId}`}>
              View all {totalApplications} applications
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
