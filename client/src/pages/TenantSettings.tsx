import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import SubscriptionManagement from "@/components/SubscriptionManagement";

export default function TenantSettings() {
  const { setCurrentPageTitle, currentTenant } = useAppStore();

  // Set page title
  useEffect(() => {
    setCurrentPageTitle("Settings");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage subscription and feature settings for {currentTenant?.name}
        </p>
      </div>
      <SubscriptionManagement />
    </div>
  );
}
