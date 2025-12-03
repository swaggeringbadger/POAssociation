import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import WorkflowSelector from "@/components/WorkflowSelector";

export default function TenantSettings() {
  const { setCurrentPageTitle, currentTenant, currentUserRole } = useAppStore();

  // Set page title
  useEffect(() => {
    setCurrentPageTitle("Settings");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  // Show workflow selector for community tenants and appropriate roles
  // Note: Only management_manager, account_admin, and super_admin can change workflows
  // Regular poa_board_member should not be able to change workflows for the entire community
  const showWorkflowSelector = currentTenant?.type === 'community' &&
    ['management_manager', 'account_admin', 'super_admin'].includes(currentUserRole || '');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage subscription and feature settings for {currentTenant?.name}
        </p>
      </div>

      {/* Workflow Settings - shown first for community tenants */}
      {showWorkflowSelector && <WorkflowSelector />}

      {/* Subscription Management */}
      <SubscriptionManagement />
    </div>
  );
}
