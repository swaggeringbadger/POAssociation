import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '../../client/src/components/ProtectedRoute';
import { useAppStore } from '../../client/src/lib/store';
import type { Role } from '../../client/src/lib/mock-data';

/**
 * ProtectedRoute Integration Tests
 *
 * Tests the ProtectedRoute component's RBAC enforcement
 * Ensures users see appropriate content based on their permissions
 */

// Create mocks before imports
const mockUseLocation = vi.fn();
const mockIsSuperAdmin = vi.fn();

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: () => mockUseLocation(),
}));

// Mock the API
vi.mock('../../client/src/lib/api', () => ({
  api: {
    isSuperAdmin: () => mockIsSuperAdmin(),
  },
}));

describe('ProtectedRoute Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Clear the store
    useAppStore.getState().clearState();

    // Reset all mocks
    vi.clearAllMocks();

    // Default mock implementations
    mockUseLocation.mockReturnValue(['/test-route', vi.fn()]);
    mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderProtectedRoute = (children: React.ReactNode, location: string = '/test-route') => {
    mockUseLocation.mockReturnValue([location, vi.fn()]);

    return render(
      <QueryClientProvider client={queryClient}>
        <ProtectedRoute>{children}</ProtectedRoute>
      </QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should show loading state while checking permissions', () => {
      // Mock API to never resolve
      mockIsSuperAdmin.mockImplementation(() => new Promise(() => {}));
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Protected Content</div>);

      expect(screen.getByText('Checking permissions...')).toBeInTheDocument();
    });
  });

  describe('Super Admin Access', () => {
    it('should allow super admins to access any route', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: true });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Protected Content</div>, '/workflows');

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('should not show access denied for super admins on admin routes', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: true });
      useAppStore.getState().setCurrentUserRole('poa_board_member');

      renderProtectedRoute(<div>Admin Content</div>, '/admin/management-companies');

      await waitFor(() => {
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });
    });
  });

  describe('Authorized Access', () => {
    it('should allow account_admin to access workflows', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('account_admin');

      renderProtectedRoute(<div>Workflow Content</div>, '/workflows');

      await waitFor(() => {
        expect(screen.getByText('Workflow Content')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should allow management_manager to access compliance', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('management_manager');

      renderProtectedRoute(<div>Compliance Content</div>, '/compliance');

      await waitFor(() => {
        expect(screen.getByText('Compliance Content')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should allow poa_board_member to access settings', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('poa_board_member');

      renderProtectedRoute(<div>Settings Content</div>, '/settings');

      await waitFor(() => {
        expect(screen.getByText('Settings Content')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should allow all authenticated users to access dashboard', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Dashboard Content</div>, '/dashboard');

      await waitFor(() => {
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Unauthorized Access', () => {
    it('should show access denied when homeowner tries to access workflows', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Workflow Content</div>, '/workflows');

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.queryByText('Workflow Content')).not.toBeInTheDocument();
      });
    });

    it('should show return to dashboard button when unauthorized', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Workflow Content</div>, '/workflows');

      await waitFor(() => {
        expect(screen.getByText('Return to Dashboard')).toBeInTheDocument();
      });
    });

    it('should deny poa_board_member access to admin routes', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('poa_board_member');

      renderProtectedRoute(<div>Admin Content</div>, '/admin/management-companies');

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      });
    });

    it('should deny homeowner access to compliance', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Compliance Content</div>, '/compliance');

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.queryByText('Compliance Content')).not.toBeInTheDocument();
      });
    });

    it('should deny homeowner access to properties', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Properties Content</div>, '/properties');

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.queryByText('Properties Content')).not.toBeInTheDocument();
      });
    });

    it('should deny management_manager access to workflows', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('management_manager');

      renderProtectedRoute(<div>Workflow Content</div>, '/workflows');

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.queryByText('Workflow Content')).not.toBeInTheDocument();
      });
    });

    it('should show appropriate unauthorized message with required roles', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Workflow Content</div>, '/workflows');

      await waitFor(() => {
        const message = screen.getByText(/Account Admin/i);
        expect(message).toBeInTheDocument();
      });
    });
  });

  describe('Public Routes', () => {
    it('should allow access to landing page', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Landing Content</div>, '/');

      await waitFor(() => {
        expect(screen.getByText('Landing Content')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should allow access to demo pages', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Demo Content</div>, '/demo');

      await waitFor(() => {
        expect(screen.getByText('Demo Content')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Dynamic Routes', () => {
    it('should handle dynamic application detail routes', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Application Detail</div>, '/applications/123');

      await waitFor(() => {
        expect(screen.getByText('Application Detail')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should deny dynamic form builder routes without permissions', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Form Builder</div>, '/form-builder/template-1');

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.queryByText('Form Builder')).not.toBeInTheDocument();
      });
    });

    it('should allow dynamic form builder routes with permissions', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('account_admin');

      renderProtectedRoute(<div>Form Builder</div>, '/form-builder/template-1');

      await waitFor(() => {
        expect(screen.getByText('Form Builder')).toBeInTheDocument();
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockIsSuperAdmin.mockRejectedValue(new Error('API Error'));
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Dashboard Content</div>, '/dashboard');

      // Should treat as non-super-admin and check role permissions
      // Homeowner should have access to dashboard
      await waitFor(() => {
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should deny access on API error for unauthorized routes', async () => {
      mockIsSuperAdmin.mockRejectedValue(new Error('API Error'));
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Workflow Content</div>, '/workflows');

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible error message heading', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Workflow Content</div>, '/workflows');

      await waitFor(() => {
        const heading = screen.getByText('Access Denied');
        expect(heading).toBeInTheDocument();
        expect(heading.tagName).toBe('H1');
      });
    });

    it('should have accessible return button', async () => {
      mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
      useAppStore.getState().setCurrentUserRole('homeowner');

      renderProtectedRoute(<div>Workflow Content</div>, '/workflows');

      await waitFor(() => {
        const button = screen.getByText('Return to Dashboard');
        expect(button).toBeInTheDocument();
        expect(button.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Role-Based Scenarios', () => {
    it('should correctly enforce dashboard access for all roles', async () => {
      const roles: Role[] = [
        'homeowner',
        'poa_board_member',
        'management_manager',
        'account_admin',
        'super_admin',
      ];

      for (const role of roles) {
        mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
        useAppStore.getState().setCurrentUserRole(role);
        queryClient.clear();

        const { unmount } = renderProtectedRoute(<div>Dashboard</div>, '/dashboard');

        await waitFor(() => {
          expect(screen.getByText('Dashboard')).toBeInTheDocument();
        }, { timeout: 2000 });

        unmount();
      }
    });

    it('should correctly enforce workflow access restrictions', async () => {
      // Only account_admin and super_admin should access
      const unauthorizedRoles: Role[] = [
        'homeowner',
        'poa_board_member',
        'management_manager',
      ];

      for (const role of unauthorizedRoles) {
        mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
        useAppStore.getState().setCurrentUserRole(role);
        queryClient.clear();

        const { unmount } = renderProtectedRoute(<div>Workflow</div>, '/workflows');

        await waitFor(() => {
          expect(screen.getByText('Access Denied')).toBeInTheDocument();
        });

        unmount();
      }

      // Now test authorized roles
      const authorizedRoles: Role[] = ['account_admin', 'super_admin'];

      for (const role of authorizedRoles) {
        mockIsSuperAdmin.mockResolvedValue({ isSuperAdmin: false });
        useAppStore.getState().setCurrentUserRole(role);
        queryClient.clear();

        const { unmount } = renderProtectedRoute(<div>Workflow</div>, '/workflows');

        await waitFor(() => {
          expect(screen.getByText('Workflow')).toBeInTheDocument();
        }, { timeout: 2000 });

        unmount();
      }
    });
  });
});
