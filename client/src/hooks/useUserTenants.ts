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

// Type for tenant from userTenants response
type UserTenantWithTenant = {
  tenantId: string;
  role: string;
  tenant: {
    id: string;
    type: string;
    managementCompanyId?: string | null;
  };
};

/**
 * Get effective roles for a tenant, considering inherited roles from management company.
 * - If tenant is a community with a managementCompanyId, inherit management_manager and account_admin from the mgmt company
 * - management_rep at mgmt company level doesn't automatically inherit (requires property assignment, handled server-side)
 */
function getEffectiveRolesForTenant(
  tenantId: string,
  userTenants: UserTenantWithTenant[]
): string[] {
  // Find the target tenant
  const targetTenantData = userTenants.find(ut => ut.tenant.id === tenantId);
  if (!targetTenantData) {
    return [];
  }

  // Get direct roles on this tenant
  const directRoles = userTenants
    .filter(ut => ut.tenantId === tenantId)
    .map(ut => ut.role);

  const targetTenant = targetTenantData.tenant;

  // If this is a community with a management company, check for inherited roles
  if (targetTenant.type === 'community' && targetTenant.managementCompanyId) {
    const mgmtCompanyId = targetTenant.managementCompanyId;
    const mgmtRoles = userTenants
      .filter(ut => ut.tenantId === mgmtCompanyId)
      .map(ut => ut.role);

    // management_manager at mgmt company = management_manager everywhere under it
    if (mgmtRoles.includes('management_manager')) {
      directRoles.push('management_manager');
    }

    // account_admin at mgmt company = account_admin everywhere under it
    if (mgmtRoles.includes('account_admin')) {
      directRoles.push('account_admin');
    }
  }

  // Return unique roles
  return Array.from(new Set(directRoles));
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
      // Extract unique tenants (dedupe by id since user may have multiple roles per tenant)
      const tenantsMap = new Map<string, typeof userTenants[0]['tenant']>();
      userTenants.forEach(ut => {
        if (!tenantsMap.has(ut.tenant.id)) {
          tenantsMap.set(ut.tenant.id, ut.tenant);
        }
      });
      const tenants = Array.from(tenantsMap.values());
      setAvailableTenants(tenants);

      // If no current tenant is set, set the first one
      if (!currentTenant || !tenants.find(t => currentTenant && t.id === currentTenant.id)) {
        setCurrentTenant(tenants[0]);
        // Get ALL effective roles for this tenant (including inherited from mgmt company)
        const rolesForTenant = getEffectiveRolesForTenant(tenants[0].id, userTenants);
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
    } else if (userTenants && userTenants.length === 0) {
      // Roleless user (e.g. freshly registered account with no tenant
      // assignments): clear any stale tenant/role state left in persisted
      // localStorage from a previous session, so they don't see a phantom
      // community they don't actually belong to.
      if (currentTenant) {
        setAvailableTenants([]);
        setCurrentTenant(null);
        setAvailableRolesForCurrentTenant([]);
      }
    }
  }, [userTenants, setAvailableTenants, setCurrentTenant, setCurrentUserRole, setAvailableRolesForCurrentTenant, currentTenant, currentUserRole]);

  // Update roles when tenant changes
  useEffect(() => {
    if (userTenants && currentTenant?.id) {
      // Get ALL effective roles for current tenant (including inherited from mgmt company)
      const rolesForTenant = getEffectiveRolesForTenant(currentTenant.id, userTenants);
      setAvailableRolesForCurrentTenant(rolesForTenant);

      // If current role is not available for this tenant, pick the highest privilege role
      // Exception: 'contractor' is a cross-tenant role, don't reset it
      if (!rolesForTenant.includes(currentUserRole) && currentUserRole !== 'contractor') {
        const defaultRole = getHighestPrivilegeRole(rolesForTenant);
        setCurrentUserRole(defaultRole);
        // Sync new role with backend when tenant changes and role needs adjustment
        syncRoleWithBackend(defaultRole);
      }
    }
  }, [currentTenant, userTenants, currentUserRole, setCurrentUserRole, setAvailableRolesForCurrentTenant]);

  // Get all effective roles for current tenant (including inherited)
  const rolesForCurrentTenant = currentTenant && userTenants
    ? getEffectiveRolesForTenant(currentTenant.id, userTenants)
    : [];

  return {
    userTenants,
    isLoading,
    error,
    rolesForCurrentTenant,
  };
}
