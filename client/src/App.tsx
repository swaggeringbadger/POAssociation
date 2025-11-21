import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import FormBuilder from "@/pages/FormBuilder";
import ApplicationSubmit from "@/pages/ApplicationSubmit";
import MarklandExample from "@/pages/MarklandExample";
import DashboardLayout from "@/components/layout/DashboardLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      
      {/* Dashboard Routes wrapped in Layout */}
      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      
      {/* Add other dashboard pages here similarly */}
      <Route path="/applications">
        <DashboardLayout>
          <div className="p-8"><h1 className="text-2xl font-bold">Applications List (Placeholder)</h1></div>
        </DashboardLayout>
      </Route>

      <Route path="/admin/form-builder">
        <DashboardLayout>
          <FormBuilder />
        </DashboardLayout>
      </Route>

      <Route path="/apply">
        <DashboardLayout>
          <ApplicationSubmit />
        </DashboardLayout>
      </Route>

      <Route path="/apply/markland-demo">
        <DashboardLayout>
          <MarklandExample />
        </DashboardLayout>
      </Route>

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
