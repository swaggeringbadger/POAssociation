import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TENANTS, Tenant, Role } from './mock-data';

interface AppState {
  currentTenant: Tenant;
  currentUserRole: Role;
  setCurrentTenant: (tenant: Tenant) => void;
  setCurrentUserRole: (role: Role) => void;
  // Helper to simulate subdomain navigation
  simulateSubdomainVisit: (subdomain: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentTenant: TENANTS[0], // Default to Apex Management
      currentUserRole: 'account_admin',
      
      setCurrentTenant: (tenant) => set({ currentTenant: tenant }),
      setCurrentUserRole: (role) => set({ currentUserRole: role }),
      
      simulateSubdomainVisit: (subdomain) => {
        const tenant = TENANTS.find(t => t.subdomain === subdomain);
        if (tenant) {
          set({ currentTenant: tenant });
          // In a real app, this would trigger a window.location.href change
          console.log(`Navigated to ${subdomain}.civicflow.com`);
        }
      }
    }),
    {
      name: 'civicflow-state',
    }
  )
);
