import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tenant } from '@/lib/api';

interface AppState {
  availableTenants: Tenant[];
  currentTenant: Tenant | null;
  currentUserRole: string;
  availableRolesForCurrentTenant: string[]; // All roles user has on current tenant
  selectedPropertyFilter: string | null; // null = "All Properties", or tenantId for specific property
  currentPageTitle: string | null; // Page title for header
  setAvailableTenants: (tenants: Tenant[]) => void;
  setCurrentTenant: (tenant: Tenant) => void;
  setCurrentUserRole: (role: string) => void;
  setAvailableRolesForCurrentTenant: (roles: string[]) => void;
  setSelectedPropertyFilter: (tenantId: string | null) => void;
  setCurrentPageTitle: (title: string | null) => void;
  // Helper to simulate subdomain navigation
  simulateSubdomainVisit: (subdomain: string) => void;
  // Clear all state (for logout)
  clearState: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      availableTenants: [],
      currentTenant: null,
      currentUserRole: 'homeowner',
      availableRolesForCurrentTenant: [],
      selectedPropertyFilter: null,
      currentPageTitle: null,

      setAvailableTenants: (tenants) => set({ availableTenants: tenants }),
      setCurrentTenant: (tenant) => set({ currentTenant: tenant }),
      setCurrentUserRole: (role) => set({ currentUserRole: role }),
      setAvailableRolesForCurrentTenant: (roles) => set({ availableRolesForCurrentTenant: roles }),
      setSelectedPropertyFilter: (tenantId) => set({ selectedPropertyFilter: tenantId }),
      setCurrentPageTitle: (title) => set({ currentPageTitle: title }),

      simulateSubdomainVisit: (subdomain) => {
        const tenant = get().availableTenants.find(t => t.subdomain === subdomain);
        if (tenant) {
          set({ currentTenant: tenant });
          // In a real app, this would trigger a window.location.href change
          console.log(`Navigated to ${subdomain}.poassociation.com`);
        }
      },

      clearState: () => {
        set({
          availableTenants: [],
          currentTenant: null,
          currentUserRole: 'homeowner',
          availableRolesForCurrentTenant: [],
          selectedPropertyFilter: null,
          currentPageTitle: null,
        });
        // Also clear from localStorage
        localStorage.removeItem('poassociation-state');
      }
    }),
    {
      name: 'poassociation-state',
      version: 3, // Increment this to clear old cached state
    }
  )
);
