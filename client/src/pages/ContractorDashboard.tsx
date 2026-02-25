import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import {
  Loader2, Wrench, Building2, FileText, Calendar, User,
  ExternalLink, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';

interface ContractorApplication {
  applicationId: string;
  applicationTitle: string;
  applicationStatus: string;
  communityName: string;
  communitySubdomain: string;
  submitterName: string;
  invitedAt: string;
  acceptedAt: string | null;
  collaboratorStatus: string;
}

interface ContractorDashboardData {
  applications: ContractorApplication[];
  stats: {
    active: number;
    pending: number;
    completed: number;
  };
}

export default function ContractorDashboard() {
  const [, setLocation] = useLocation();
  const { setCurrentPageTitle } = useAppStore();

  useEffect(() => {
    setCurrentPageTitle("Contractor Dashboard");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  // Fetch contractor dashboard data
  const { data: profile } = useQuery({
    queryKey: ['contractor-profile'],
    queryFn: () => api.getMyContractorProfile(),
  });

  const { data: dashboard, isLoading, error } = useQuery<ContractorDashboardData>({
    queryKey: ['contractor-dashboard', profile?.id],
    queryFn: () => api.getContractorDashboard(profile!.id),
    enabled: !!profile?.id,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'active':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Wrench className="w-3 h-3 mr-1" />Active</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getApplicationStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Submitted</Badge>;
      case 'under_review':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Under Review</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case 'denied':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Denied</Badge>;
      case 'requires_changes':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Changes Required</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No contractor profile
  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contractor Dashboard</h1>
          <p className="text-muted-foreground">
            View and manage all your application collaborations
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">Create Your Contractor Profile</h3>
            <p className="text-muted-foreground mb-4">
              Set up your profile to collaborate on applications and earn referrals.
            </p>
            <Button onClick={() => setLocation('/contractor/profile')}>
              <Building2 className="h-4 w-4 mr-2" />
              Create Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contractor Dashboard</h1>
          <p className="text-muted-foreground">
            {profile.companyName || 'My'} application collaborations
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation('/contractor/profile')}>
          <Building2 className="h-4 w-4 mr-2" />
          My Profile
        </Button>
      </div>

      {/* Stats */}
      {dashboard?.stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.stats.pending}</div>
                  <p className="text-sm text-muted-foreground">Pending Invitations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Wrench className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.stats.active}</div>
                  <p className="text-sm text-muted-foreground">Active Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{dashboard.stats.completed}</div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Applications List */}
      {!dashboard?.applications?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">No applications yet</h3>
            <p className="text-muted-foreground">
              You haven't been invited to collaborate on any applications yet.
              <br />
              Share your profile with homeowners to get started!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Applications</h2>
          {dashboard.applications.map((app) => (
            <Card key={app.applicationId} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{app.applicationTitle}</h3>
                      {getApplicationStatusBadge(app.applicationStatus)}
                      {getStatusBadge(app.collaboratorStatus)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {app.communityName}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {app.submitterName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Invited {format(new Date(app.invitedAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Navigate to application - need to handle cross-tenant
                      // For now, construct URL with subdomain query param
                      setLocation(`/applications/${app.applicationId}?subdomain=${app.communitySubdomain}`);
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertCircle className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900">About Contractor Collaborations</h3>
              <p className="text-sm text-blue-700 mt-1">
                When you're invited to an application, you can view and edit the application form
                to help homeowners with technical details. Your access is limited to the specific
                applications you're invited to.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
