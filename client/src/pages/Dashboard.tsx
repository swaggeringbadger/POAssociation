import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { ArrowUpRight, Clock, FileCheck, Plus, Sparkles, Building, Home, ShieldCheck, Users, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { currentUserRole, currentTenant } = useAppStore();

  // Render different dashboard views based on role
  if (currentUserRole === 'management_manager' || currentUserRole === 'management_rep') {
    return <ManagementDashboard />;
  }

  if (currentUserRole === 'poa_board_member' || currentUserRole === 'hoa_board_member') {
    return <BoardMemberDashboard />;
  }

  if (currentUserRole === 'poa_board_contributor') {
    return <ContributorDashboard />;
  }

  if (currentUserRole === 'homeowner') {
    return <HomeownerDashboard />;
  }

  // Default dashboard for other roles
  return <GeneralDashboard />;
}

// Management Dashboard - Overview of multiple communities
function ManagementDashboard() {
  const { currentTenant, availableTenants, selectedPropertyFilter } = useAppStore();
  const { user } = useAuth();

  // Fetch applications for management view
  const { data: applications = [] } = useQuery({
    queryKey: ['management-applications', selectedPropertyFilter, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // For management users, fetch applications across all their tenants or filtered tenant
      const tenantId = selectedPropertyFilter || currentTenant?.id;
      if (!tenantId) return [];
      
      const url = `/api/applications/list?role=management_manager&tenantId=${tenantId}&userId=${user.id}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data as any[];
    },
    enabled: !!user?.id,
  });

  const pendingReviews = applications.filter(app => 
    app.status === 'pending'
  ).length;

  const activeProjects = applications.filter(app => 
    app.status === 'under_review'
  ).length;

  const selectedTenant = selectedPropertyFilter
    ? availableTenants.find(t => t.id === selectedPropertyFilter)
    : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">Management Dashboard</CardTitle>
              <CardDescription className="text-blue-100">
                {selectedTenant?.name || 'All Communities'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Communities Managed" value={selectedPropertyFilter ? "1" : availableTenants.length.toString()} icon={Building} trend="Active" />
        <StatsCard title="Pending Reviews" value={pendingReviews.toString()} icon={Clock} trend={`Across ${selectedPropertyFilter ? 'community' : 'all communities'}`} />
        <StatsCard title="Active Projects" value={activeProjects.toString()} icon={FileCheck} trend={`In progress`} />
        <StatsCard title="Total Applications" value={applications.length.toString()} icon={Plus} trend={`${selectedPropertyFilter ? 'This community' : 'All communities'}`} />
      </div>

      <div className="grid gap-8 md:grid-cols-7">
        {/* Main Activity Feed */}
        <div className="col-span-4 space-y-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>
                {selectedPropertyFilter ? 'Recent applications for this community' : 'Applications across all managed communities'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {applications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No applications found</p>
                ) : (
                  [...applications]
                    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                    .slice(0, 5)
                    .map((app) => {
                      const getInitials = (title: string) => {
                        const words = title.split(' ').filter(w => w.length > 0);
                        if (words.length >= 2) {
                          return (words[0][0] + words[1][0]).toUpperCase();
                        }
                        return title.slice(0, 2).toUpperCase();
                      };
                      
                      const getTimeAgo = (date: string) => {
                        const now = new Date();
                        const submitted = new Date(date);
                        const diffMs = now.getTime() - submitted.getTime();
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        
                        if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                        if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                        return 'Just now';
                      };
                      
                      const getStatusBadge = (status: string) => {
                        switch (status) {
                          case 'pending':
                            return <Badge variant="default">Needs Review</Badge>;
                          case 'under_review':
                            return <Badge variant="secondary">In Review</Badge>;
                          case 'approved':
                            return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
                          case 'rejected':
                            return <Badge variant="destructive">Rejected</Badge>;
                          default:
                            return <Badge variant="outline">{status}</Badge>;
                        }
                      };
                      
                      return (
                        <Link key={app.id} href={`/applications/${app.id}`}>
                          <div className="flex items-center justify-between group cursor-pointer">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
                                {getInitials(app.title)}
                              </div>
                              <div>
                                <p className="font-medium group-hover:text-primary transition-colors">
                                  {app.title} - {app.propertyAddress}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {getTimeAgo(app.submittedAt)} • {app.tenantName || 'Unknown Community'}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(app.status)}
                          </div>
                        </Link>
                      );
                    })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Link href="/forms">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Form Template
                </Button>
              </Link>
              <Link href="/applications">
                <Button variant="outline">View All Applications</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Community Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const tenantsToShow = selectedPropertyFilter 
                  ? availableTenants.filter(t => t.id === selectedPropertyFilter)
                  : availableTenants;
                const uniqueTenants = tenantsToShow.filter((tenant, index, self) => 
                  self.findIndex(t => t.id === tenant.id) === index
                ).slice(0, 5);
                
                return uniqueTenants.map((tenant, i) => {
                  const tenantApps = applications.filter(app => app.tenantId === tenant.id);
                  const pendingCount = tenantApps.filter(app => app.status === 'pending').length;
                  const reviewCount = tenantApps.filter(app => app.status === 'under_review').length;
                  const totalCount = tenantApps.length;
                  
                  return (
                    <div key={`community-${tenant.id}-${i}`}>
                      {i > 0 && <Separator className="my-4" />}
                      <div className="space-y-2">
                        <p className="font-medium">{tenant.name}</p>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Pending</span>
                          <span className="font-medium">{pendingCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">In Review</span>
                          <span className="font-medium">{reviewCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-medium">{totalCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Board Member Dashboard - Focus on reviewing applications
function BoardMemberDashboard() {
  const { currentTenant } = useAppStore();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-none">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">Board Member Dashboard</CardTitle>
              <CardDescription className="text-purple-100">
                {currentTenant?.name || 'Your Community'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Needs Review" value="8" icon={Clock} trend="Priority queue" />
        <StatsCard title="Under Review" value="4" icon={ArrowUpRight} trend="In progress" />
        <StatsCard title="Approved This Month" value="23" icon={CheckCircle} trend="+12% from last month" />
        <StatsCard title="Rejected" value="2" icon={AlertCircle} trend="Requires resubmission" />
      </div>

      <div className="grid gap-8 md:grid-cols-7">
        {/* Main Review Queue */}
        <div className="col-span-4 space-y-8">
          <Card className="shadow-sm border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Applications Awaiting Review
              </CardTitle>
              <CardDescription>Review and approve architectural modification requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
                        {["JD", "RM", "SK", "TL"][i - 1]}
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors cursor-pointer">
                          {["Fence Installation", "Deck Addition", "Exterior Paint Change", "Shed Installation"][i - 1]} -
                          {[" 123 Oak St", " 456 Pine Ave", " 789 Maple Dr", " 321 Elm St"][i - 1]}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Submitted {i} {i === 1 ? "day" : "days"} ago
                        </p>
                      </div>
                    </div>
                    <Link href="/applications">
                      <Button size="sm">Review</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Link href="/applications">
                <Button>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Review Applications
                </Button>
              </Link>
              <Link href="/apply">
                <Button variant="outline">Submit New Request</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Community Status</CardTitle>
              <CardDescription>{currentTenant?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next Board Meeting</span>
                <span className="font-medium">Nov 28, 7:00 PM</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Decisions</span>
                <span className="font-medium">8 applications</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Average Review Time</span>
                <span className="font-medium">3.2 days</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-900">Review Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-800">
                Remember to review inline bylaw guidance when evaluating applications. All decisions should align with community standards.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Contributor Dashboard - Can view and comment but not approve
function ContributorDashboard() {
  const { currentTenant } = useAppStore();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-none">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">Board Contributor Dashboard</CardTitle>
              <CardDescription className="text-orange-100">
                {currentTenant?.name || 'Your Community'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Applications to Review" value="8" icon={Clock} trend="Your input needed" />
        <StatsCard title="Comments Added" value="12" icon={Users} trend="This month" />
        <StatsCard title="Under Review" value="4" icon={ArrowUpRight} trend="Awaiting decision" />
        <StatsCard title="Completed" value="23" icon={CheckCircle} trend="This month" />
      </div>

      <div className="grid gap-8 md:grid-cols-7">
        {/* Main Activity Feed */}
        <div className="col-span-4 space-y-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Applications for Review</CardTitle>
              <CardDescription>Provide feedback and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
                        {["JD", "RM", "SK"][i - 1]}
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors cursor-pointer">
                          {["Fence Installation", "Deck Addition", "Exterior Paint Change"][i - 1]} -
                          {[" 123 Oak St", " 456 Pine Ave", " 789 Maple Dr"][i - 1]}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Submitted {i} {i === 1 ? "day" : "days"} ago
                        </p>
                      </div>
                    </div>
                    <Link href="/applications">
                      <Button size="sm" variant="outline">View & Comment</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Link href="/applications">
                <Button>
                  <Users className="mr-2 h-4 w-4" />
                  View Applications
                </Button>
              </Link>
              <Link href="/apply">
                <Button variant="outline">Submit Request</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Your Role</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                As a Board Contributor, you can review applications and provide feedback, but final approval decisions are made by board members.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community Status</CardTitle>
              <CardDescription>{currentTenant?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next Board Meeting</span>
                <span className="font-medium">Nov 28, 7:00 PM</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Decisions</span>
                <span className="font-medium">8 applications</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Homeowner Dashboard - Focus on submitting and tracking own applications
function HomeownerDashboard() {
  const { currentTenant } = useAppStore();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-none">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Home className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">Homeowner Dashboard</CardTitle>
              <CardDescription className="text-green-100">
                {currentTenant?.name || 'Your Community'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="My Applications" value="3" icon={FileCheck} trend="Total submitted" />
        <StatsCard title="Pending" value="1" icon={Clock} trend="Awaiting review" />
        <StatsCard title="Approved" value="2" icon={CheckCircle} trend="This year" />
        <StatsCard title="Next Meeting" value="Nov 28" icon={Users} trend="7:00 PM" />
      </div>

      <div className="grid gap-8 md:grid-cols-7">
        {/* Main Activity Feed */}
        <div className="col-span-4 space-y-8">
          <Card className="shadow-sm border-blue-200">
            <CardHeader>
              <CardTitle>Submit New Application</CardTitle>
              <CardDescription>Request approval for property modifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Need to make changes to your property? Submit an application for board review and approval.
              </p>
              <Link href="/apply">
                <Button size="lg" className="w-full">
                  <Plus className="mr-2 h-5 w-5" />
                  Start New Application
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>My Applications</CardTitle>
              <CardDescription>Track the status of your submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { title: "Fence Installation - 123 Oak St", status: "Pending", days: 2 },
                  { title: "Exterior Paint Change - 123 Oak St", status: "Approved", days: 14 },
                  { title: "Mailbox Replacement - 123 Oak St", status: "Approved", days: 45 },
                ].map((app, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div>
                      <p className="font-medium group-hover:text-primary transition-colors cursor-pointer">
                        {app.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Submitted {app.days} days ago
                      </p>
                    </div>
                    <Badge variant={app.status === "pending" ? "default" : "secondary"}>
                      {app.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Community Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Before submitting an application, review the community architectural guidelines to ensure your project complies.
              </p>
              <Button variant="outline" size="sm" className="w-full">
                View Guidelines
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community Info</CardTitle>
              <CardDescription>{currentTenant?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next Board Meeting</span>
                <span className="font-medium">Nov 28, 7:00 PM</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Management Rep</span>
                <span className="font-medium">Sarah Jenkins</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Office Hours</span>
                <span className="font-medium">M-F, 9am - 5pm</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// General Dashboard - Fallback for other roles
function GeneralDashboard() {
  const { currentTenant } = useAppStore();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Pending Requests" value="12" icon={Clock} trend="+2 from yesterday" />
        <StatsCard title="Active Projects" value="89" icon={FileCheck} trend="+15% this month" />
        <StatsCard title="Total Units" value="245" icon={Plus} trend="Fully occupied" />
        <StatsCard title="Completed" value="156" icon={CheckCircle} trend="This year" />
      </div>

      <div className="grid gap-8 md:grid-cols-7">
        {/* Main Activity Feed */}
        <div className="col-span-4 space-y-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>Latest architectural modification requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
                        JD
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors cursor-pointer">
                          Fence Installation - 123 Oak St
                        </p>
                        <p className="text-sm text-muted-foreground">Submitted 2 days ago</p>
                      </div>
                    </div>
                    <Badge variant={i === 1 ? "default" : "secondary"}>
                      {i === 1 ? "Needs Review" : "In Progress"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Link href="/apply">
                <Button>Start New Application</Button>
              </Link>
              <Link href="/applications">
                <Button variant="outline">View Applications</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Community Status</CardTitle>
              <CardDescription>{currentTenant?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next Board Meeting</span>
                <span className="font-medium">Nov 28, 7:00 PM</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Management Rep</span>
                <span className="font-medium">Sarah Jenkins</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Office Hours</span>
                <span className="font-medium">M-F, 9am - 5pm</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend }: { title: string, value: string, icon: any, trend: string }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{trend}</p>
      </CardContent>
    </Card>
  );
}
