import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useEffect, useRef } from "react";
import type { User } from "@shared/schema";

// Role hierarchy for determining default role (highest privilege first)
const ROLE_HIERARCHY = [
  'super_admin',
  'account_admin',
  'management_manager',
  'management_rep',
  'poa_board_member',
  'poa_board_contributor',
  'delegated_rep',
  'homeowner',
];

function getHighestPrivilegeRole(roles: string[]): string {
  for (const hierarchyRole of ROLE_HIERARCHY) {
    if (roles.includes(hierarchyRole)) {
      return hierarchyRole;
    }
  }
  return roles[0] || 'homeowner';
}

// Sync role with backend session
async function syncRoleWithBackend(role: string): Promise<void> {
  try {
    await fetch('/api/auth/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
  } catch (error) {
    console.error('Failed to sync role with backend:', error);
  }
}

export function useUserTenants() {
  const { user: authUser } = useAuth();
  const user = authUser as User | undefined;
  const {
    setAvailableTenants,
    setCurrentTenant,
    setCurrentUserRole,
    setAvailableRolesForCurrentTenant,
    currentTenant,
    currentUserRole
  } = useAppStore();

  const { data: userTenants, isLoading, error } = useQuery({
    queryKey: ['userTenants', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return api.getUserTenants(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Track if we've synced the initial role to avoid duplicate syncs
  const hasInitializedRole = useRef(false);

  // Update store when user tenants are loaded
  useEffect(() => {
    if (userTenants && userTenants.length > 0) {
      // Extract unique tenants
      const tenants = userTenants.map(ut => ut.tenant);
      setAvailableTenants(tenants);

      // If no current tenant is set, set the first one
      if (!currentTenant || !tenants.find(t => currentTenant && t.id === currentTenant.id)) {
        setCurrentTenant(tenants[0]);
        // Get ALL roles for this tenant
        const rolesForTenant = userTenants
          .filter(ut => ut.tenantId === tenants[0].id)
          .map(ut => ut.role);
        setAvailableRolesForCurrentTenant(rolesForTenant);
        // Set the highest privilege role as default
        const defaultRole = getHighestPrivilegeRole(rolesForTenant);
        setCurrentUserRole(defaultRole);
        // Sync the initial role with the backend session
        if (!hasInitializedRole.current) {
          hasInitializedRole.current = true;
          syncRoleWithBackend(defaultRole);
        }
      } else if (!hasInitializedRole.current && currentUserRole) {
        // If tenant was already set (from localStorage), still sync the role
        hasInitializedRole.current = true;
        syncRoleWithBackend(currentUserRole);
      }
    }
  }, [userTenants, setAvailableTenants, setCurrentTenant, setCurrentUserRole, setAvailableRolesForCurrentTenant, currentTenant, currentUserRole]);

  // Update roles when tenant changes
  useEffect(() => {
    if (userTenants && currentTenant?.id) {
      // Get ALL roles for current tenant
      const rolesForTenant = userTenants
        .filter(ut => ut.tenantId === currentTenant.id)
        .map(ut => ut.role);
      setAvailableRolesForCurrentTenant(rolesForTenant);

      // If current role is not available for this tenant, pick the highest privilege role
      if (!rolesForTenant.includes(currentUserRole)) {
        const defaultRole = getHighestPrivilegeRole(rolesForTenant);
        setCurrentUserRole(defaultRole);
        // Sync new role with backend when tenant changes and role needs adjustment
        syncRoleWithBackend(defaultRole);
      }
    }
  }, [currentTenant, userTenants, currentUserRole, setCurrentUserRole, setAvailableRolesForCurrentTenant]);

  // Get all roles for current tenant
  const rolesForCurrentTenant = currentTenant
    ? userTenants?.filter(ut => ut.tenantId === currentTenant.id).map(ut => ut.role)
    : [];

  return {
    userTenants,
    isLoading,
    error,
    rolesForCurrentTenant,
  };
}
