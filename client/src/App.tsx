import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import CommunityLanding from "@/pages/CommunityLanding";
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
import MobileDocumentUpload from "@/pages/MobileDocumentUpload";
import ConsumptionDashboard from "@/pages/ConsumptionDashboard";
import PaymentMethodsPage from "@/pages/PaymentMethodsPage";
import PricingPage from "@/pages/PricingPage";
import LegalPage from "@/pages/LegalPage";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function Router() {
  // Referenced from Replit Auth integration: blueprint:javascript_log_in_with_replit
  const { isAuthenticated, isLoading } = useAuth();

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
      {/* Demo routes - accessible without auth */}
      <Route path="/demo" component={DemoCodeEntry} />
      <Route path="/demo/personas" component={DemoPersonaSelect} />

      {/* Mobile document upload - accessible without auth */}
      <Route path="/upload/:token" component={MobileDocumentUpload} />

      {/* Public pricing page - accessible without auth */}
      <Route path="/pricing" component={PricingPage} />

      {/* Public legal page - accessible without auth */}
      <Route path="/legal" component={LegalPage} />

      {/* Community landing for subdomain access when not authenticated */}
      {showCommunityLanding && (
        <Route path="/">
          {() => <CommunityLanding subdomain={subdomain} />}
        </Route>
      )}

      {isLoading || !isAuthenticated || isLoggingOut ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          {/* Redirect root to dashboard when authenticated */}
          <Route path="/">
            {() => <Redirect to="/dashboard" />}
          </Route>

          {/* Dashboard Routes wrapped in Layout */}
          <Route path="/dashboard">
            <ProtectedRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
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
        </>
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
