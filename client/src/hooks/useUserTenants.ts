import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useEffect } from "react";
import type { User } from "@shared/schema";

export function useUserTenants() {
  const { user: authUser } = useAuth();
  const user = authUser as User | undefined;
  const { setAvailableTenants, setCurrentTenant, setCurrentUserRole, currentTenant } = useAppStore();

  const { data: userTenants, isLoading, error } = useQuery({
    queryKey: ['userTenants', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return api.getUserTenants(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update store when user tenants are loaded
  useEffect(() => {
    if (userTenants && userTenants.length > 0) {
      // Extract unique tenants
      const tenants = userTenants.map(ut => ut.tenant);
      setAvailableTenants(tenants);

      // If no current tenant is set, set the first one
      if (!currentTenant || !tenants.find(t => currentTenant && t.id === currentTenant.id)) {
        setCurrentTenant(tenants[0]);
        // Set the role for this tenant
        const assignment = userTenants.find(ut => ut.tenantId === tenants[0].id);
        if (assignment) {
          setCurrentUserRole(assignment.role);
        }
      }
    }
  }, [userTenants, setAvailableTenants, setCurrentTenant, setCurrentUserRole, currentTenant]);

  // Update role when tenant changes
  useEffect(() => {
    if (userTenants && currentTenant?.id) {
      const assignment = userTenants.find(ut => ut.tenantId === currentTenant.id);
      if (assignment && assignment.role !== useAppStore.getState().currentUserRole) {
        setCurrentUserRole(assignment.role);
      }
    }
  }, [currentTenant, userTenants, setCurrentUserRole]);

  // Get role for current tenant
  const currentRole = currentTenant ? userTenants?.find(ut => ut.tenantId === currentTenant.id)?.role : undefined;

  return {
    userTenants,
    isLoading,
    error,
    currentRole,
  };
}
