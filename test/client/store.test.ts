import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../client/src/lib/store';
import type { Tenant } from '../../client/src/lib/api';
import { createTestTenant } from '../utils/test-helpers';

/**
 * Zustand Store Tests
 *
 * Tests for global application state management
 * Demonstrates testing of Zustand stores with persist middleware
 */

describe('useAppStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    useAppStore.getState().clearState();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAppStore.getState();

      expect(state.availableTenants).toEqual([]);
      expect(state.currentTenant).toBeNull();
      expect(state.currentUserRole).toBe('homeowner');
      expect(state.availableRolesForCurrentTenant).toEqual([]);
      expect(state.selectedPropertyFilter).toBeNull();
      expect(state.currentPageTitle).toBeNull();
    });
  });

  describe('setAvailableTenants', () => {
    it('should set available tenants', () => {
      const tenants = [
        createTestTenant({ name: 'Tenant 1' }),
        createTestTenant({ name: 'Tenant 2' }),
      ] as Tenant[];

      useAppStore.getState().setAvailableTenants(tenants);

      expect(useAppStore.getState().availableTenants).toEqual(tenants);
      expect(useAppStore.getState().availableTenants).toHaveLength(2);
    });

    it('should replace existing tenants', () => {
      const tenants1 = [createTestTenant({ name: 'Tenant 1' })] as Tenant[];
      const tenants2 = [createTestTenant({ name: 'Tenant 2' })] as Tenant[];

      useAppStore.getState().setAvailableTenants(tenants1);
      expect(useAppStore.getState().availableTenants).toHaveLength(1);

      useAppStore.getState().setAvailableTenants(tenants2);
      expect(useAppStore.getState().availableTenants).toHaveLength(1);
      expect(useAppStore.getState().availableTenants[0].name).toBe('Tenant 2');
    });
  });

  describe('setCurrentTenant', () => {
    it('should set current tenant', () => {
      const tenant = createTestTenant({ name: 'Test Tenant' }) as Tenant;

      useAppStore.getState().setCurrentTenant(tenant);

      expect(useAppStore.getState().currentTenant).toEqual(tenant);
      expect(useAppStore.getState().currentTenant?.name).toBe('Test Tenant');
    });
  });

  describe('setCurrentUserRole', () => {
    it('should set current user role', () => {
      useAppStore.getState().setCurrentUserRole('poa_board_member');

      expect(useAppStore.getState().currentUserRole).toBe('poa_board_member');
    });

    it('should update from default homeowner role', () => {
      expect(useAppStore.getState().currentUserRole).toBe('homeowner');

      useAppStore.getState().setCurrentUserRole('management_manager');

      expect(useAppStore.getState().currentUserRole).toBe('management_manager');
    });
  });

  describe('setAvailableRolesForCurrentTenant', () => {
    it('should set available roles', () => {
      const roles = ['homeowner', 'poa_board_member', 'management_manager'];

      useAppStore.getState().setAvailableRolesForCurrentTenant(roles);

      expect(useAppStore.getState().availableRolesForCurrentTenant).toEqual(roles);
      expect(useAppStore.getState().availableRolesForCurrentTenant).toHaveLength(3);
    });
  });

  describe('setSelectedPropertyFilter', () => {
    it('should set property filter to specific tenant', () => {
      const tenantId = 'test-tenant-1';

      useAppStore.getState().setSelectedPropertyFilter(tenantId);

      expect(useAppStore.getState().selectedPropertyFilter).toBe(tenantId);
    });

    it('should set property filter to null for all properties', () => {
      useAppStore.getState().setSelectedPropertyFilter('test-tenant-1');
      expect(useAppStore.getState().selectedPropertyFilter).toBe('test-tenant-1');

      useAppStore.getState().setSelectedPropertyFilter(null);
      expect(useAppStore.getState().selectedPropertyFilter).toBeNull();
    });
  });

  describe('setCurrentPageTitle', () => {
    it('should set page title', () => {
      useAppStore.getState().setCurrentPageTitle('Dashboard');

      expect(useAppStore.getState().currentPageTitle).toBe('Dashboard');
    });

    it('should clear page title', () => {
      useAppStore.getState().setCurrentPageTitle('Dashboard');
      useAppStore.getState().setCurrentPageTitle(null);

      expect(useAppStore.getState().currentPageTitle).toBeNull();
    });
  });

  describe('simulateSubdomainVisit', () => {
    it('should set current tenant when visiting valid subdomain', () => {
      const tenant1 = createTestTenant({ subdomain: 'community1' }) as Tenant;
      const tenant2 = createTestTenant({ subdomain: 'community2' }) as Tenant;

      useAppStore.getState().setAvailableTenants([tenant1, tenant2]);
      useAppStore.getState().simulateSubdomainVisit('community2');

      expect(useAppStore.getState().currentTenant).toEqual(tenant2);
    });

    it('should not change current tenant when visiting invalid subdomain', () => {
      const tenant = createTestTenant({ subdomain: 'community1' }) as Tenant;

      useAppStore.getState().setAvailableTenants([tenant]);
      useAppStore.getState().setCurrentTenant(tenant);
      useAppStore.getState().simulateSubdomainVisit('nonexistent');

      // Should still be the original tenant
      expect(useAppStore.getState().currentTenant).toEqual(tenant);
    });
  });

  describe('clearState', () => {
    it('should reset all state to initial values', () => {
      // Set up some state
      const tenant = createTestTenant() as Tenant;
      useAppStore.getState().setAvailableTenants([tenant]);
      useAppStore.getState().setCurrentTenant(tenant);
      useAppStore.getState().setCurrentUserRole('poa_board_member');
      useAppStore.getState().setAvailableRolesForCurrentTenant(['homeowner', 'poa_board_member']);
      useAppStore.getState().setSelectedPropertyFilter('test-tenant-1');
      useAppStore.getState().setCurrentPageTitle('Dashboard');

      // Clear all state
      useAppStore.getState().clearState();

      // Verify reset
      const state = useAppStore.getState();
      expect(state.availableTenants).toEqual([]);
      expect(state.currentTenant).toBeNull();
      expect(state.currentUserRole).toBe('homeowner');
      expect(state.availableRolesForCurrentTenant).toEqual([]);
      expect(state.selectedPropertyFilter).toBeNull();
      expect(state.currentPageTitle).toBeNull();
    });
  });

  describe('Complex Workflows', () => {
    it('should handle complete tenant switch workflow', () => {
      const tenant1 = createTestTenant({
        name: 'Community 1',
        subdomain: 'community1'
      }) as Tenant;
      const tenant2 = createTestTenant({
        name: 'Community 2',
        subdomain: 'community2'
      }) as Tenant;

      // Initialize with multiple tenants
      useAppStore.getState().setAvailableTenants([tenant1, tenant2]);
      useAppStore.getState().setCurrentTenant(tenant1);
      useAppStore.getState().setCurrentUserRole('homeowner');
      useAppStore.getState().setAvailableRolesForCurrentTenant(['homeowner']);

      // Verify initial state
      expect(useAppStore.getState().currentTenant?.name).toBe('Community 1');
      expect(useAppStore.getState().currentUserRole).toBe('homeowner');

      // Switch to second tenant with different role
      useAppStore.getState().setCurrentTenant(tenant2);
      useAppStore.getState().setCurrentUserRole('poa_board_member');
      useAppStore.getState().setAvailableRolesForCurrentTenant(['poa_board_member', 'homeowner']);

      // Verify switched state
      expect(useAppStore.getState().currentTenant?.name).toBe('Community 2');
      expect(useAppStore.getState().currentUserRole).toBe('poa_board_member');
      expect(useAppStore.getState().availableRolesForCurrentTenant).toContain('poa_board_member');
    });
  });
});
