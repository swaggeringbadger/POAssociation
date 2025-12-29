/**
 * AccountAdminBilling - Billing landing page for Account Admins
 *
 * Shows all managed properties with current month balance breakdown.
 * Allows drill-down to property detail.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Receipt,
  Building2,
  Zap,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  FileText,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getAccountAdminBillingSummary,
  type AccountAdminBillingSummary,
  type PropertyBillingSummary
} from '@/lib/api';

export default function AccountAdminBilling() {
  const { data, isLoading, error } = useQuery<AccountAdminBillingSummary>({
    queryKey: ['account-admin-billing-summary'],
    queryFn: getAccountAdminBillingSummary,
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get current period display
  const getCurrentPeriodDisplay = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Calculate credit usage percentage
  const getCreditUsagePercent = (property: PropertyBillingSummary) => {
    if (property.creditsIncluded === 0) return 0;
    return Math.min(100, (property.creditsUsed / property.creditsIncluded) * 100);
  };

  // Get tier badge color
  const getTierBadgeVariant = (tierCode: string | null): 'default' | 'secondary' | 'outline' => {
    switch (tierCode) {
      case 'xl':
        return 'default';
      case 'large':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load billing data: {(error as Error).message}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { properties, totals } = data || { properties: [], totals: { totalCreditsUsed: 0, totalOverageCost: 0, totalApplications: 0, totalAiAnalyses: 0 } };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Billing Overview
          </h1>
          <p className="text-muted-foreground">
            {getCurrentPeriodDisplay()} billing summary across all properties
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Credits Used</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              {totals.totalCreditsUsed}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across all properties this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Overage Cost</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {totals.totalOverageCost > 0 && (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {formatCurrency(totals.totalOverageCost)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {totals.totalOverageCost > 0 ? 'Additional charges' : 'No overages'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Applications Submitted</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              {totals.totalApplications}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              New applications this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>AI Analyses Run</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              {totals.totalAiAnalyses}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Credits consumed by AI
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Properties Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Properties
          </CardTitle>
          <CardDescription>
            Current billing period breakdown by property
          </CardDescription>
        </CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No properties found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Credits Used</TableHead>
                  <TableHead>Overage</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property.communityId}>
                    <TableCell className="font-medium">
                      {property.communityName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTierBadgeVariant(property.tierCode)}>
                        {property.subscriptionTier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>
                            {property.creditsUsed} / {property.creditsIncluded}
                          </span>
                          {property.isOverage && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <Progress
                          value={getCreditUsagePercent(property)}
                          className={`h-2 ${property.isOverage ? '[&>div]:bg-amber-500' : ''}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {property.overageCost > 0 ? (
                        <span className="text-amber-600 font-medium">
                          {formatCurrency(property.overageCost)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">$0.00</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {property.applicationCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/account-admin/billing/${property.communityId}`}>
                          View Details
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
