import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import FormBuilder from "@/pages/FormBuilder";
import ApplicationSubmit from "@/pages/ApplicationSubmit";
import ApplicationTypeSelect from "@/pages/ApplicationTypeSelect";
import Applications from "@/pages/Applications";
import ApplicationDetail from "@/pages/ApplicationDetail";
import MarklandExample from "@/pages/MarklandExample";
import DemoCodeEntry from "@/pages/DemoCodeEntry";
import DemoPersonaSelect from "@/pages/DemoPersonaSelect";
import Directory from "@/pages/Directory";
import Properties from "@/pages/Properties";
import Settings from "@/pages/Settings";
import DemoCodes from "@/pages/admin/DemoCodes";
import DemoCodeForm from "@/pages/admin/DemoCodeForm";
import DemoCodeStats from "@/pages/admin/DemoCodeStats";
import ManagementCompanies from "@/pages/admin/ManagementCompanies";
import Communities from "@/pages/admin/Communities";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  // Referenced from Replit Auth integration: blueprint:javascript_log_in_with_replit
  const { isAuthenticated, isLoading } = useAuth();

  // Check if we're in logout mode to prevent redirect loop
  const urlParams = new URLSearchParams(window.location.search);
  const isLoggingOut = urlParams.get('logout') === 'true';

  return (
    <Switch>
      {/* Demo routes - accessible without auth */}
      <Route path="/demo" component={DemoCodeEntry} />
      <Route path="/demo/personas" component={DemoPersonaSelect} />

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
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          </Route>

          {/* Add other dashboard pages here similarly */}
          <Route path="/applications">
            <DashboardLayout>
              <div className="p-8">
                <Applications />
              </div>
            </DashboardLayout>
          </Route>

          <Route path="/applications/:id">
            <DashboardLayout>
              <div className="p-8">
                <ApplicationDetail />
              </div>
            </DashboardLayout>
          </Route>

          <Route path="/admin/form-builder">
            <DashboardLayout>
              <FormBuilder />
            </DashboardLayout>
          </Route>

          <Route path="/apply">
            <DashboardLayout>
              <ApplicationTypeSelect />
            </DashboardLayout>
          </Route>

          <Route path="/applications/submit/:typeId">
            <DashboardLayout>
              <ApplicationSubmit />
            </DashboardLayout>
          </Route>

          <Route path="/apply/markland-demo">
            <DashboardLayout>
              <MarklandExample />
            </DashboardLayout>
          </Route>

          <Route path="/directory">
            <DashboardLayout>
              <Directory />
            </DashboardLayout>
          </Route>

          <Route path="/properties">
            <DashboardLayout>
              <Properties />
            </DashboardLayout>
          </Route>

          <Route path="/settings">
            <DashboardLayout>
              <Settings />
            </DashboardLayout>
          </Route>

          {/* Admin Routes */}
          <Route path="/admin/management-companies">
            <DashboardLayout>
              <ManagementCompanies />
            </DashboardLayout>
          </Route>

          <Route path="/admin/communities">
            <DashboardLayout>
              <Communities />
            </DashboardLayout>
          </Route>

          <Route path="/admin/demo-codes">
            <DashboardLayout>
              <DemoCodes />
            </DashboardLayout>
          </Route>

          <Route path="/admin/demo-codes/:id">
            {(params) => (
              <DashboardLayout>
                {params.id === 'new' || params.id?.endsWith('/edit') ? (
                  <DemoCodeForm />
                ) : params.id?.endsWith('/stats') ? (
                  <DemoCodeStats />
                ) : (
                  <DemoCodeForm />
                )}
              </DashboardLayout>
            )}
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
