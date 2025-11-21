import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { ArrowLeft, Users, Activity, Clock, TrendingUp, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function DemoCodeStats() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  // Fetch demo code details
  const { data: demoCodes, isLoading: isLoadingCodes } = useQuery({
    queryKey: ['/api/admin/demo-codes'],
    queryFn: () => api.listDemoCodes(),
  });

  const demoCode = demoCodes?.find((c: any) => c.id === id);

  // Fetch stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/admin/demo-codes', id, 'stats'],
    queryFn: () => api.getDemoCodeStats(id!),
    enabled: !!id,
  });

  const isLoading = isLoadingCodes || isLoadingStats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!demoCode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/demo-codes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Demo Code Not Found</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">The requested demo code could not be found.</p>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/demo-codes')}
              className="mt-4"
            >
              Back to Demo Codes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = () => {
    const now = new Date();
    const validFrom = new Date(demoCode.validFrom);
    const validUntil = new Date(demoCode.validUntil);

    if (!demoCode.isProvisioned) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Provisioning
        </Badge>
      );
    }

    if (!demoCode.isActive) {
      return (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="h-3 w-3" />
          Inactive
        </Badge>
      );
    }

    if (now < validFrom) {
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Scheduled
        </Badge>
      );
    }

    if (now > validUntil) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }

    if (demoCode.maxUses && demoCode.currentUses >= demoCode.maxUses) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Limit Reached
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle className="h-3 w-3" />
        Active
      </Badge>
    );
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/demo-codes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-mono">{demoCode.code}</h1>
            {getStatusBadge()}
          </div>
          <p className="text-muted-foreground">{demoCode.label}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/demo-codes/${id}/edit`)}
          >
            Edit
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              <CardDescription>Current Uses</CardDescription>
            </div>
            <CardTitle className="text-3xl">
              {stats?.currentUses || 0}
              {demoCode.maxUses && (
                <span className="text-lg text-muted-foreground ml-2">
                  / {demoCode.maxUses}
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <CardDescription>Total Sessions</CardDescription>
            </div>
            <CardTitle className="text-3xl">{stats?.totalSessions || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <CardDescription>Unique Users</CardDescription>
            </div>
            <CardTitle className="text-3xl">{stats?.uniqueUsers || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <CardDescription>Avg Duration</CardDescription>
            </div>
            <CardTitle className="text-3xl">
              {formatDuration(stats?.avgSessionDuration || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Code Information */}
        <Card>
          <CardHeader>
            <CardTitle>Demo Code Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Code</p>
              <p className="text-lg font-mono font-semibold">{demoCode.code}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Label</p>
              <p className="text-lg">{demoCode.label}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">{getStatusBadge()}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Provisioning Status</p>
              <p className="text-lg">
                {demoCode.isProvisioned ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </span>
                ) : (
                  <span className="text-yellow-600 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    In Progress
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Validity Period */}
        <Card>
          <CardHeader>
            <CardTitle>Validity Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valid From</p>
              <p className="text-lg">{format(new Date(demoCode.validFrom), 'PPP p')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
              <p className="text-lg">{format(new Date(demoCode.validUntil), 'PPP p')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="text-lg">{format(new Date(demoCode.createdAt), 'PPP p')}</p>
            </div>
            {demoCode.provisionedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Provisioned</p>
                <p className="text-lg">{format(new Date(demoCode.provisionedAt), 'PPP p')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Uses</p>
              <p className="text-lg">
                {stats?.currentUses || 0}
                {demoCode.maxUses && ` of ${demoCode.maxUses}`}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Usage Limit</p>
              <p className="text-lg">{demoCode.maxUses ? demoCode.maxUses : 'Unlimited'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
              <p className="text-lg">{stats?.totalSessions || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Unique Users</p>
              <p className="text-lg">{stats?.uniqueUsers || 0}</p>
            </div>
          </CardContent>
        </Card>

        {/* Session Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Session Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Average Duration</p>
              <p className="text-lg">{formatDuration(stats?.avgSessionDuration || 0)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
              <p className="text-lg">{stats?.totalSessions || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sessions per Use</p>
              <p className="text-lg">
                {stats?.currentUses && stats?.currentUses > 0
                  ? (stats.totalSessions / stats.currentUses).toFixed(1)
                  : '0'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demo Ecosystem Info */}
      <Card>
        <CardHeader>
          <CardTitle>Provisioned Demo Ecosystem</CardTitle>
          <CardDescription>
            Resources created for this demo code
          </CardDescription>
        </CardHeader>
        <CardContent>
          {demoCode.isProvisioned ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium">Management Company</p>
                </div>
                <p className="text-2xl font-bold">1</p>
                <p className="text-xs text-muted-foreground">Apex Management Solutions</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium">Communities</p>
                </div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-xs text-muted-foreground">Markland POA, Whispering Pines HOA</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium">Demo Users</p>
                </div>
                <p className="text-2xl font-bold">4</p>
                <p className="text-xs text-muted-foreground">Emily, Sarah, James, Alex</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium">Form Templates</p>
                </div>
                <p className="text-2xl font-bold">4</p>
                <p className="text-xs text-muted-foreground">2 per community</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium">Applications</p>
                </div>
                <p className="text-2xl font-bold">~30</p>
                <p className="text-xs text-muted-foreground">Various statuses</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium">User Roles</p>
                </div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-xs text-muted-foreground">Across all tenants</p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Ecosystem provisioning in progress...</p>
              <p className="text-sm text-muted-foreground mt-2">This usually takes 30-60 seconds</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
