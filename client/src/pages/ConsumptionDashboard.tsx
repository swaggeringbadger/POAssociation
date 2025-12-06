import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getConsumptionSummary,
  getUsageHistory,
  listInvoices,
  downloadInvoicePdf,
  type BillingConsumptionSummary,
  type UsageHistoryMonth,
  type InvoiceWithLineItems,
  type CommunityConsumption,
} from '@/lib/api';
import {
  DollarSign,
  Zap,
  FileText,
  AlertTriangle,
  TrendingUp,
  Building2,
  Calendar,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  CreditCard,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

// Tier badge component
function TierBadge({ tierCode }: { tierCode: string }) {
  const colors: Record<string, string> = {
    small: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-blue-100 text-blue-800 border-blue-200',
    large: 'bg-purple-100 text-purple-800 border-purple-200',
    xl: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  const labels: Record<string, string> = {
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    xl: 'XL',
  };

  return (
    <Badge variant="outline" className={colors[tierCode] || colors.small}>
      {labels[tierCode] || tierCode}
    </Badge>
  );
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Summary cards component
function ConsumptionSummaryCards({ summary }: { summary: BillingConsumptionSummary }) {
  const hasOverage = summary.totalOverageCredits > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Monthly Charges</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalProjectedCharges)}</div>
          <p className="text-xs text-muted-foreground">
            Base: {formatCurrency(summary.totalBaseCharges)} + Overage: {formatCurrency(summary.totalOverageCharges)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.totalCreditsUsed} / {summary.totalCreditsIncluded}
          </div>
          <Progress
            value={(summary.totalCreditsUsed / summary.totalCreditsIncluded) * 100}
            className="mt-2"
          />
          {hasOverage && (
            <p className="text-xs text-orange-600 mt-1">
              +{summary.totalOverageCredits} overage credits
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Applications This Month</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalApplicationsThisMonth}</div>
          <p className="text-xs text-muted-foreground">
            Across {summary.communities.length} communit{summary.communities.length === 1 ? 'y' : 'ies'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Billing Cycle</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.daysRemaining} days left</div>
          <p className="text-xs text-muted-foreground">
            Resets {formatDate(summary.currentPeriodEnd)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Overage alert component
function OverageAlert({ summary }: { summary: BillingConsumptionSummary }) {
  const communitiesInOverage = summary.communities.filter(c => c.overageCredits > 0);

  if (communitiesInOverage.length === 0) return null;

  return (
    <Alert variant="destructive" className="bg-orange-50 border-orange-200">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800">Overage Alert</AlertTitle>
      <AlertDescription className="text-orange-700">
        {communitiesInOverage.length} communit{communitiesInOverage.length === 1 ? 'y has' : 'ies have'} exceeded
        their included credits this month. Additional charges of {formatCurrency(summary.totalOverageCharges)} will apply.
      </AlertDescription>
    </Alert>
  );
}

// Community billing table component
function CommunityBillingTable({ communities }: { communities: CommunityConsumption[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Community Breakdown
        </CardTitle>
        <CardDescription>
          Usage and charges per community for the current billing period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Community</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Doors</TableHead>
              <TableHead className="text-right">Base Price</TableHead>
              <TableHead className="text-center">Credits</TableHead>
              <TableHead className="text-right">Overage</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {communities.map((community) => (
              <TableRow key={community.communityId}>
                <TableCell className="font-medium">
                  {community.communityName}
                  {community.hasCustomPricing && (
                    <Badge variant="outline" className="ml-2 text-xs">Custom</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <TierBadge tierCode={community.tierCode} />
                </TableCell>
                <TableCell>{community.doorCount}</TableCell>
                <TableCell className="text-right">{formatCurrency(community.effectivePrice)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span>{community.creditsUsed}/{community.creditsIncluded}</span>
                    {community.overageCredits > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        +{community.overageCredits}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {community.overageCost > 0 ? (
                    <span className="text-orange-600">{formatCurrency(community.overageCost)}</span>
                  ) : (
                    <span className="text-muted-foreground">$0.00</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(community.effectivePrice + community.overageCost)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Usage history chart component
function UsageHistoryChart({ history }: { history: UsageHistoryMonth[] }) {
  const chartData = history.map(h => ({
    ...h,
    month: new Date(h.month + '-01').toLocaleDateString('en-US', { month: 'short' }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Usage Trends
        </CardTitle>
        <CardDescription>Credits and applications over the past 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="creditsUsed" name="Credits" fill="#8884d8" />
            <Bar yAxisId="left" dataKey="overageCredits" name="Overage" fill="#ff7300" />
            <Bar yAxisId="right" dataKey="applicationsSubmitted" name="Applications" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Cost trend chart
function CostTrendChart({ history }: { history: UsageHistoryMonth[] }) {
  const chartData = history.map(h => ({
    month: new Date(h.month + '-01').toLocaleDateString('en-US', { month: 'short' }),
    total: h.totalCost,
    overage: h.overageCost,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Trends
        </CardTitle>
        <CardDescription>Monthly costs including overage charges</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `$${value}`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="total" name="Total Cost" stroke="#8884d8" strokeWidth={2} />
            <Line type="monotone" dataKey="overage" name="Overage" stroke="#ff7300" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Recent invoices component
function RecentInvoices({ invoices }: { invoices: InvoiceWithLineItems[] }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    finalized: 'bg-blue-100 text-blue-800',
    sent: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    void: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Recent Invoices
        </CardTitle>
        <CardDescription>Your billing history</CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
        ) : (
          <div className="space-y-3">
            {invoices.slice(0, 5).map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium">{invoice.invoiceNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(invoice.billingPeriodStart)} - {formatDate(invoice.billingPeriodEnd)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[invoice.status]}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                  <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
                  {/* Pay Now button for unpaid invoices with Stripe hosted URL */}
                  {invoice.stripeHostedInvoiceUrl && invoice.status !== 'paid' && invoice.status !== 'void' && (
                    <a
                      href={invoice.stripeHostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="default">
                        Pay Now
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadInvoicePdf(invoice.id, invoice.invoiceNumber)}
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Loading skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

// Main dashboard component
export default function ConsumptionDashboard() {
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['billing-consumption'],
    queryFn: getConsumptionSummary,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['billing-history'],
    queryFn: () => getUsageHistory(6),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => listInvoices(5),
  });

  if (summaryLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <h1 className="text-3xl font-bold mb-6">Billing & Usage</h1>
        <DashboardSkeleton />
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div className="container mx-auto py-6 px-4">
        <h1 className="text-3xl font-bold mb-6">Billing & Usage</h1>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {summaryError instanceof Error ? summaryError.message : 'Failed to load billing data. You may not have permission to view this page.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Usage</h1>
          <p className="text-muted-foreground">
            {summary.billingEntityName} •
            {summary.billingEntityType === 'management_company' ? ' Management Company' : ' Community'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/billing/payment-methods">
            <Button variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Methods
            </Button>
          </Link>
          <Button variant="outline">
            <Receipt className="h-4 w-4 mr-2" />
            Download Statement
          </Button>
        </div>
      </div>

      {/* Overage alert */}
      <OverageAlert summary={summary} />

      {/* Summary cards */}
      <ConsumptionSummaryCards summary={summary} />

      {/* Community breakdown */}
      <CommunityBillingTable communities={summary.communities} />

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {history && history.length > 0 && <UsageHistoryChart history={history} />}
        {history && history.length > 0 && <CostTrendChart history={history} />}
      </div>

      {/* Recent invoices */}
      {invoices && <RecentInvoices invoices={invoices} />}
    </div>
  );
}
