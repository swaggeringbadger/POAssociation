import { describe, it, expect } from 'vitest';

/**
 * User Tenants Hook Logic Tests
 *
 * Tests for the logic used in useUserTenants hook from recent commits:
 * - Role hierarchy determination
 * - Tenant deduplication (fixes duplicate tenants in community switcher)
 *
 * Note: The actual hook uses React Query and needs integration testing.
 * These tests cover the pure logic functions.
 */

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

/**
 * Get highest privilege role from an array of roles
 */
function getHighestPrivilegeRole(roles: string[]): string {
  for (const hierarchyRole of ROLE_HIERARCHY) {
    if (roles.includes(hierarchyRole)) {
      return hierarchyRole;
    }
  }
  return roles[0] || 'homeowner';
}

/**
 * Deduplicate tenants by ID
 * This fixes the bug where users with multiple roles on same tenant
 * would see the tenant multiple times in the dropdown
 */
function deduplicateTenants<T extends { tenant: { id: string } }>(userTenants: T[]): T['tenant'][] {
  const tenantsMap = new Map<string, T['tenant']>();
  userTenants.forEach(ut => {
    if (!tenantsMap.has(ut.tenant.id)) {
      tenantsMap.set(ut.tenant.id, ut.tenant);
    }
  });
  return Array.from(tenantsMap.values());
}

describe('User Tenants Logic', () => {
  describe('getHighestPrivilegeRole', () => {
    it('should return super_admin as highest', () => {
      const roles = ['homeowner', 'super_admin', 'poa_board_member'];
      expect(getHighestPrivilegeRole(roles)).toBe('super_admin');
    });

    it('should return account_admin over management roles', () => {
      const roles = ['management_manager', 'account_admin', 'homeowner'];
      expect(getHighestPrivilegeRole(roles)).toBe('account_admin');
    });

    it('should return management_manager over rep', () => {
      const roles = ['management_rep', 'management_manager'];
      expect(getHighestPrivilegeRole(roles)).toBe('management_manager');
    });

    it('should return management_rep over board roles', () => {
      const roles = ['poa_board_member', 'management_rep', 'homeowner'];
      expect(getHighestPrivilegeRole(roles)).toBe('management_rep');
    });

    it('should return poa_board_member over contributor', () => {
      const roles = ['poa_board_contributor', 'poa_board_member'];
      expect(getHighestPrivilegeRole(roles)).toBe('poa_board_member');
    });

    it('should return poa_board_contributor over delegated_rep', () => {
      const roles = ['delegated_rep', 'poa_board_contributor'];
      expect(getHighestPrivilegeRole(roles)).toBe('poa_board_contributor');
    });

    it('should return delegated_rep over homeowner', () => {
      const roles = ['homeowner', 'delegated_rep'];
      expect(getHighestPrivilegeRole(roles)).toBe('delegated_rep');
    });

    it('should return homeowner when it is the only role', () => {
      const roles = ['homeowner'];
      expect(getHighestPrivilegeRole(roles)).toBe('homeowner');
    });

    it('should return first role when no hierarchy match', () => {
      const roles = ['unknown_role', 'another_unknown'];
      expect(getHighestPrivilegeRole(roles)).toBe('unknown_role');
    });

    it('should return homeowner for empty array', () => {
      const roles: string[] = [];
      expect(getHighestPrivilegeRole(roles)).toBe('homeowner');
    });

    it('should handle single high-privilege role', () => {
      const roles = ['super_admin'];
      expect(getHighestPrivilegeRole(roles)).toBe('super_admin');
    });
  });

  describe('deduplicateTenants', () => {
    it('should return unique tenants when user has one role per tenant', () => {
      const userTenants = [
        { tenant: { id: 'tenant-1', name: 'Community A' }, role: 'homeowner' },
        { tenant: { id: 'tenant-2', name: 'Community B' }, role: 'poa_board_member' },
      ];

      const result = deduplicateTenants(userTenants);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tenant-1');
      expect(result[1].id).toBe('tenant-2');
    });

    it('should deduplicate when user has multiple roles on same tenant', () => {
      // Bug scenario: Emily has both management_manager and account_admin on Apex Management
      const userTenants = [
        { tenant: { id: 'apex-1', name: 'Apex Management' }, role: 'management_manager' },
        { tenant: { id: 'apex-1', name: 'Apex Management' }, role: 'account_admin' },
        { tenant: { id: 'markland-1', name: 'Markland Woods' }, role: 'homeowner' },
      ];

      const result = deduplicateTenants(userTenants);

      expect(result).toHaveLength(2);
      expect(result.find(t => t.id === 'apex-1')).toBeDefined();
      expect(result.find(t => t.id === 'markland-1')).toBeDefined();
    });

    it('should preserve first occurrence tenant data', () => {
      const userTenants = [
        { tenant: { id: 'tenant-1', name: 'First Name', extra: 'data' }, role: 'role1' },
        { tenant: { id: 'tenant-1', name: 'Second Name', extra: 'different' }, role: 'role2' },
      ];

      const result = deduplicateTenants(userTenants);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('First Name');
      expect((result[0] as any).extra).toBe('data');
    });

    it('should handle empty array', () => {
      const result = deduplicateTenants([]);
      expect(result).toHaveLength(0);
    });

    it('should handle single tenant', () => {
      const userTenants = [
        { tenant: { id: 'tenant-1', name: 'Only Tenant' }, role: 'homeowner' },
      ];

      const result = deduplicateTenants(userTenants);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Only Tenant');
    });

    it('should handle complex scenario with many duplicates', () => {
      // Scenario: User is super admin with roles on multiple tenants
      const userTenants = [
        { tenant: { id: 't1', name: 'Tenant 1' }, role: 'super_admin' },
        { tenant: { id: 't1', name: 'Tenant 1' }, role: 'account_admin' },
        { tenant: { id: 't1', name: 'Tenant 1' }, role: 'management_manager' },
        { tenant: { id: 't2', name: 'Tenant 2' }, role: 'poa_board_member' },
        { tenant: { id: 't2', name: 'Tenant 2' }, role: 'homeowner' },
        { tenant: { id: 't3', name: 'Tenant 3' }, role: 'homeowner' },
      ];

      const result = deduplicateTenants(userTenants);

      expect(result).toHaveLength(3);
      expect(result.map(t => t.id).sort()).toEqual(['t1', 't2', 't3']);
    });
  });

  describe('Role Selection After Tenant Change', () => {
    /**
     * When tenant changes, if current role is not available for new tenant,
     * pick the highest privilege role
     */
    it('should select highest privilege role when current role unavailable', () => {
      const currentRole = 'management_manager';
      const availableRolesForNewTenant = ['poa_board_member', 'homeowner'];

      const isCurrentRoleAvailable = availableRolesForNewTenant.includes(currentRole);
      const newRole = isCurrentRoleAvailable
        ? currentRole
        : getHighestPrivilegeRole(availableRolesForNewTenant);

      expect(isCurrentRoleAvailable).toBe(false);
      expect(newRole).toBe('poa_board_member');
    });

    it('should keep current role when available in new tenant', () => {
      const currentRole = 'poa_board_member';
      const availableRolesForNewTenant = ['poa_board_member', 'homeowner'];

      const isCurrentRoleAvailable = availableRolesForNewTenant.includes(currentRole);
      const newRole = isCurrentRoleAvailable
        ? currentRole
        : getHighestPrivilegeRole(availableRolesForNewTenant);

      expect(isCurrentRoleAvailable).toBe(true);
      expect(newRole).toBe('poa_board_member');
    });
  });

  describe('Role Hierarchy Completeness', () => {
    it('should include all 8 defined user roles', () => {
      expect(ROLE_HIERARCHY).toHaveLength(8);
      expect(ROLE_HIERARCHY).toContain('super_admin');
      expect(ROLE_HIERARCHY).toContain('account_admin');
      expect(ROLE_HIERARCHY).toContain('management_manager');
      expect(ROLE_HIERARCHY).toContain('management_rep');
      expect(ROLE_HIERARCHY).toContain('poa_board_member');
      expect(ROLE_HIERARCHY).toContain('poa_board_contributor');
      expect(ROLE_HIERARCHY).toContain('delegated_rep');
      expect(ROLE_HIERARCHY).toContain('homeowner');
    });

    it('should have super_admin at index 0 (highest)', () => {
      expect(ROLE_HIERARCHY[0]).toBe('super_admin');
    });

    it('should have homeowner at last index (lowest)', () => {
      expect(ROLE_HIERARCHY[ROLE_HIERARCHY.length - 1]).toBe('homeowner');
    });
  });
});
