/**
 * AccountAdminBillingDetail - Property billing detail page
 *
 * Shows detailed billing activity and invoice management for a specific property.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import {
  ArrowLeft,
  Zap,
  AlertTriangle,
  FileText,
  Sparkles,
  Loader2,
  Calendar,
  Download,
  Send,
  Plus,
  ExternalLink,
  ChevronDown,
  Receipt
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getAccountAdminBillingDetail,
  generateCommunityInvoice,
  sendCommunityInvoice,
  downloadInvoicePdf,
  type AccountAdminBillingDetail,
  type BillingActivity,
} from '@/lib/api';

type PeriodType = 'month' | 'lastMonth' | 'quarter' | 'year';

export default function AccountAdminBillingDetailPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const [period, setPeriod] = useState<PeriodType>('month');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AccountAdminBillingDetail>({
    queryKey: ['account-admin-billing-detail', communityId, period],
    queryFn: () => getAccountAdminBillingDetail(communityId!, period),
    enabled: !!communityId,
  });

  // Generate invoice mutation
  const generateInvoiceMutation = useMutation({
    mutationFn: () => generateCommunityInvoice(communityId!),
    onSuccess: () => {
      toast({
        title: 'Invoice Generated',
        description: 'A new invoice has been created.',
      });
      queryClient.invalidateQueries({ queryKey: ['account-admin-billing-detail', communityId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Send invoice mutation
  const sendInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => sendCommunityInvoice(communityId!, invoiceId),
    onSuccess: () => {
      toast({
        title: 'Invoice Sent',
        description: 'The invoice has been emailed to the community.',
      });
      queryClient.invalidateQueries({ queryKey: ['account-admin-billing-detail', communityId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format datetime
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get period label
  const getPeriodLabel = () => {
    if (!data) return '';
    const start = new Date(data.period.start);
    const end = new Date(data.period.end);
    return `${formatDate(data.period.start)} - ${formatDate(data.period.end)}`;
  };

  // Get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ai_analysis':
        return <Sparkles className="h-4 w-4 text-violet-500" />;
      case 'application_submitted':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'form_created':
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Get invoice status badge
  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500">Paid</Badge>;
      case 'sent':
        return <Badge variant="secondary">Sent</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'finalized':
        return <Badge variant="secondary">Finalized</Badge>;
      case 'void':
        return <Badge variant="destructive">Void</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate credit usage percentage
  const getCreditUsagePercent = () => {
    if (!data || data.subscription.creditsIncluded === 0) return 0;
    return Math.min(100, (data.subscription.creditsUsed / data.subscription.creditsIncluded) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load billing data: {(error as Error)?.message || 'Unknown error'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/account-admin/billing" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Billing
        </Link>
        <span>/</span>
        <span className="text-foreground">{data.community.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.community.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Badge variant="outline">{data.community.subscriptionTier}</Badge>
            <span className="text-sm">{getPeriodLabel()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Subscription Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Credit Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">
                  {data.subscription.creditsUsed} / {data.subscription.creditsIncluded}
                </span>
                <span className="text-muted-foreground">credits used</span>
              </div>
              {data.subscription.overageCost > 0 && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">
                    Overage: {formatCurrency(data.subscription.overageCost)}
                  </span>
                </div>
              )}
            </div>
            <Progress
              value={getCreditUsagePercent()}
              className={`h-3 ${data.subscription.creditsUsed > data.subscription.creditsIncluded ? '[&>div]:bg-amber-500' : ''}`}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{data.subscription.creditsRemaining} credits remaining</span>
              <span>Base: {formatCurrency(data.subscription.effectivePrice)}/mo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Activity and Invoices */}
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Activity Log
              </CardTitle>
              <CardDescription>
                All billable activities for this period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No activity in this period</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.activities.map((activity) => (
                      <TableRow
                        key={activity.id}
                        className={activity.isOverage ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                      >
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDateTime(activity.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActivityIcon(activity.type)}
                            <span>{activity.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {activity.entityName ? (
                            <span className="text-sm text-muted-foreground">
                              {activity.entityName}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {activity.creditsUsed > 0 ? (
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3 text-yellow-500" />
                              <span>{activity.creditsUsed}</span>
                              {activity.isOverage && (
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {activity.cost != null && activity.cost > 0 ? (
                            <span className="text-amber-600">
                              {formatCurrency(activity.cost)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {activity.userName}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Invoices
                  </CardTitle>
                  <CardDescription>
                    Invoice history and management
                  </CardDescription>
                </div>
                <Button
                  onClick={() => generateInvoiceMutation.mutate()}
                  disabled={generateInvoiceMutation.isPending}
                >
                  {generateInvoiceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Generate Invoice
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No invoices found</p>
                  <p className="text-sm mt-2">Generate an invoice to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          {getInvoiceStatusBadge(invoice.status)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(invoice.amount)}
                        </TableCell>
                        <TableCell>
                          {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(invoice.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Actions
                                <ChevronDown className="h-4 w-4 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => downloadInvoicePdf(invoice.id, invoice.invoiceNumber)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </DropdownMenuItem>
                              {invoice.status !== 'paid' && invoice.status !== 'void' && (
                                <DropdownMenuItem
                                  onClick={() => sendInvoiceMutation.mutate(invoice.id)}
                                  disabled={sendInvoiceMutation.isPending}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Send to Community
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link href={`/invoices/${invoice.id}`}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
