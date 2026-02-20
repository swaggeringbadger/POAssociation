import { Switch, Route, Redirect, useParams, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { PENDING_INVITATION_KEY } from "@/pages/InvitationAccept";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import CommunityLanding from "@/pages/CommunityLanding";
import ManagementLanding from "@/pages/ManagementLanding";
import Dashboard from "@/pages/Dashboard";
import FormBuilder from "@/pages/FormBuilder";
import ApplicationSubmit from "@/pages/ApplicationSubmit";
import ApplicationTypeSelect from "@/pages/ApplicationTypeSelect";
import Applications from "@/pages/Applications";
import ApplicationDetail from "@/pages/ApplicationDetail";
import ApplicationEdit from "@/pages/ApplicationEdit";
import MarklandExample from "@/pages/MarklandExample";
import DemoCodeEntry from "@/pages/DemoCodeEntry";
import DemoPersonaSelect from "@/pages/DemoPersonaSelect";
import Directory from "@/pages/Directory";
import Properties from "@/pages/Properties";
import Team from "@/pages/Team";
import FormWizard from "@/pages/FormWizard";
import FormBuilderPage from "@/pages/FormBuilderPage";
import WorkflowDesignerPage from "@/pages/WorkflowDesignerPage";
import WorkflowTemplatesPage from "@/pages/WorkflowTemplatesPage";
import TenantSettings from "@/pages/TenantSettings";
import Compliance from "@/pages/Compliance";
import Calendar from "@/pages/Calendar";
import ProfileSettings from "@/pages/ProfileSettings";
import PropertySubscription from "@/pages/PropertySubscription";
import DemoCodes from "@/pages/admin/DemoCodes";
import DemoCodeForm from "@/pages/admin/DemoCodeForm";
import DemoCodeStats from "@/pages/admin/DemoCodeStats";
import ManagementCompanies from "@/pages/admin/ManagementCompanies";
import Communities from "@/pages/admin/Communities";
import AIActivity from "@/pages/admin/AIActivity";
import EmailTemplates from "@/pages/admin/EmailTemplates";
import TourContent from "@/pages/admin/TourContent";
import MobileDocumentUpload from "@/pages/MobileDocumentUpload";
import ConsumptionDashboard from "@/pages/ConsumptionDashboard";
import PaymentMethodsPage from "@/pages/PaymentMethodsPage";
import PricingPage from "@/pages/PricingPage";
import LegalPage from "@/pages/LegalPage";
import JoinCommunity from "@/pages/JoinCommunity";
import InvitationAccept from "@/pages/InvitationAccept";
import ReferralLanding from "@/pages/ReferralLanding";
import HouseholdSettings from "@/pages/HouseholdSettings";
import ContractorProfile from "@/pages/ContractorProfile";
import ContractorDashboard from "@/pages/ContractorDashboard";
import ContractorReferrals from "@/pages/ContractorReferrals";
import AccountAdminBilling from "@/pages/AccountAdminBilling";
import AccountAdminBillingDetail from "@/pages/AccountAdminBillingDetail";
import MeetingAgenda from "@/pages/MeetingAgenda";
import AgendaPresentation from "@/pages/AgendaPresentation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Wrapper component for path-based community landing
function CommunityLandingByPath() {
  const { subdomain } = useParams<{ subdomain: string }>();
  if (!subdomain) return null;
  return <CommunityLanding subdomain={subdomain} />;
}

// Wrapper component for path-based management landing
function ManagementLandingByPath() {
  const { subdomain } = useParams<{ subdomain: string }>();
  if (!subdomain) return null;
  return <ManagementLanding subdomain={subdomain} />;
}

function Router() {
  // Referenced from Replit Auth integration: blueprint:javascript_log_in_with_replit
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Check for pending invitation after authentication (fallback if session-based returnTo fails)
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const pendingInvitation = localStorage.getItem(PENDING_INVITATION_KEY);
      // Only redirect if we're not already on an invite page and have a pending invitation
      if (pendingInvitation && !location.startsWith('/invite/')) {
        console.log('[App] Found pending invitation in localStorage, redirecting:', pendingInvitation);
        // Clear it before redirecting to avoid loops
        localStorage.removeItem(PENDING_INVITATION_KEY);
        setLocation(`/invite/${pendingInvitation}`);
      }
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  // Check for subdomain context
  const { data: subdomainData } = useQuery<{ subdomain: string | null; hostname: string }>({
    queryKey: ['subdomain'],
    queryFn: async () => {
      // Also check URL query param for testing: ?subdomain=markland
      const urlParams = new URLSearchParams(window.location.search);
      const querySubdomain = urlParams.get('subdomain');
      if (querySubdomain) {
        return { subdomain: querySubdomain, hostname: window.location.hostname };
      }
      const response = await fetch('/api/subdomain');
      return response.json();
    },
    staleTime: Infinity, // Subdomain doesn't change during a session
  });

  // Check if we're in logout mode to prevent redirect loop
  const urlParams = new URLSearchParams(window.location.search);
  const isLoggingOut = urlParams.get('logout') === 'true';

  // If we have a subdomain and user is not authenticated, show community landing
  const subdomain = subdomainData?.subdomain;
  const showCommunityLanding = subdomain && !isAuthenticated && !isLoading && !isLoggingOut;

  return (
    <Switch>
      {/* Logout route - redirects to server endpoint */}
      <Route path="/logout">
        {() => {
          window.location.href = '/api/auth/logout-redirect';
          return null;
        }}
      </Route>

      {/* Demo routes - accessible without auth */}
      <Route path="/demo" component={DemoCodeEntry} />
      <Route path="/demo/personas" component={DemoPersonaSelect} />

      {/* Mobile document upload - accessible without auth */}
      <Route path="/upload/:token" component={MobileDocumentUpload} />

      {/* Invitation accept page - public but requires auth to accept */}
      <Route path="/invite/:token" component={InvitationAccept} />

      {/* Referral landing page - public */}
      <Route path="/r/:code" component={ReferralLanding} />

      {/* Public pricing page - accessible without auth */}
      <Route path="/pricing" component={PricingPage} />

      {/* Public legal page - accessible without auth */}
      <Route path="/legal" component={LegalPage} />

      {/* Path-based community/management landing pages - accessible without auth */}
      <Route path="/community/:subdomain" component={CommunityLandingByPath} />
      <Route path="/management/:subdomain" component={ManagementLandingByPath} />

      {/* Dashboard Routes wrapped in Layout - ProtectedRoute handles auth redirect */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Join Community - requires auth but not tenant membership */}
      <Route path="/join">
        <ProtectedRoute>
          <JoinCommunity />
        </ProtectedRoute>
      </Route>

      {/* Add other dashboard pages here similarly */}
      <Route path="/applications">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <Applications />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/applications/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <ApplicationDetail />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/applications/:id/edit">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <ApplicationEdit />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/form-builder">
        <ProtectedRoute>
          <DashboardLayout>
            <FormBuilder />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/apply">
        <ProtectedRoute>
          <DashboardLayout>
            <ApplicationTypeSelect />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/applications/submit/:typeId">
        <ProtectedRoute>
          <DashboardLayout>
            <ApplicationSubmit />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/apply/markland-demo">
        <ProtectedRoute>
          <DashboardLayout>
            <MarklandExample />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/directory">
        <ProtectedRoute>
          <DashboardLayout>
            <Directory />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/properties">
        <ProtectedRoute>
          <DashboardLayout>
            <Properties />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/team">
        <ProtectedRoute>
          <DashboardLayout>
            <Team />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/compliance">
        <ProtectedRoute>
          <DashboardLayout>
            <Compliance />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/calendar">
        <ProtectedRoute>
          <DashboardLayout>
            <Calendar />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/calendar/events/:eventId/agenda/present">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <AgendaPresentation />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/calendar/events/:eventId/agenda">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <MeetingAgenda />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/form-wizard">
        <ProtectedRoute>
          <DashboardLayout>
            <FormWizard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/form-builder/:templateId">
        <ProtectedRoute>
          <FormBuilderPage />
        </ProtectedRoute>
      </Route>

      <Route path="/workflows">
        <ProtectedRoute>
          <DashboardLayout>
            <WorkflowTemplatesPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/workflow-designer/:templateId">
        <ProtectedRoute>
          <WorkflowDesignerPage />
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <DashboardLayout>
            <TenantSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/profile">
        <ProtectedRoute>
          <DashboardLayout>
            <ProfileSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Household Settings */}
      <Route path="/settings/household">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <HouseholdSettings />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Contractor Routes */}
      <Route path="/contractor">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <ContractorDashboard />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/contractor/profile">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <ContractorProfile />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/contractor/referrals">
        <ProtectedRoute>
          <DashboardLayout>
            <div className="p-8">
              <ContractorReferrals />
            </div>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/properties/:propertyId/subscription">
        <ProtectedRoute>
          <DashboardLayout>
            <PropertySubscription />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Billing Dashboard */}
      <Route path="/billing">
        <ProtectedRoute>
          <DashboardLayout>
            <ConsumptionDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Payment Methods */}
      <Route path="/billing/payment-methods">
        <ProtectedRoute>
          <DashboardLayout>
            <PaymentMethodsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Account Admin Billing Routes */}
      <Route path="/account-admin/billing">
        <ProtectedRoute>
          <DashboardLayout>
            <AccountAdminBilling />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/account-admin/billing/:communityId">
        <ProtectedRoute>
          <DashboardLayout>
            <AccountAdminBillingDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin Routes */}
      <Route path="/admin/management-companies">
        <ProtectedRoute>
          <DashboardLayout>
            <ManagementCompanies />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/communities">
        <ProtectedRoute>
          <DashboardLayout>
            <Communities />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/ai-activity">
        <ProtectedRoute>
          <DashboardLayout>
            <AIActivity />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/email-templates">
        <ProtectedRoute>
          <DashboardLayout>
            <EmailTemplates />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/tours">
        <ProtectedRoute>
          <DashboardLayout>
            <TourContent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/demo-codes">
        <ProtectedRoute>
          <DashboardLayout>
            <DemoCodes />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/demo-codes/new">
        <ProtectedRoute>
          <DashboardLayout>
            <DemoCodeForm />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/demo-codes/:id/edit">
        <ProtectedRoute>
          <DashboardLayout>
            <DemoCodeForm />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/demo-codes/:id/stats">
        <ProtectedRoute>
          <DashboardLayout>
            <DemoCodeStats />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/demo-codes/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <DemoCodeForm />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Root route - show landing or redirect to dashboard */}
      {showCommunityLanding ? (
        <Route path="/">
          {() => <CommunityLanding subdomain={subdomain} />}
        </Route>
      ) : isLoading || isLoggingOut ? (
        <Route path="/" component={Landing} />
      ) : isAuthenticated ? (
        <Route path="/">
          {() => <Redirect to="/dashboard" />}
        </Route>
      ) : (
        <Route path="/" component={Landing} />
      )}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
