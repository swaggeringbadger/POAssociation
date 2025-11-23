import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tenant } from '@/lib/api';

interface AppState {
  availableTenants: Tenant[];
  currentTenant: Tenant | null;
  currentUserRole: string;
  setAvailableTenants: (tenants: Tenant[]) => void;
  setCurrentTenant: (tenant: Tenant) => void;
  setCurrentUserRole: (role: string) => void;
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

      setAvailableTenants: (tenants) => set({ availableTenants: tenants }),
      setCurrentTenant: (tenant) => set({ currentTenant: tenant }),
      setCurrentUserRole: (role) => set({ currentUserRole: role }),

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
        });
        // Also clear from localStorage
        localStorage.removeItem('poassociation-state');
      }
    }),
    {
      name: 'poassociation-state',
      version: 1, // Increment this to clear old cached state
    }
  )
);
