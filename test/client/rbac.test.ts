import { describe, it, expect } from 'vitest';
import { hasRoutePermission, getUnauthorizedMessage, ROUTE_PERMISSIONS } from '../../client/src/lib/rbac';
import type { Role } from '../../client/src/lib/mock-data';

/**
 * RBAC (Role-Based Access Control) Tests
 *
 * Tests for permission checking utilities that enforce route-level authorization
 * Critical for security - ensures users can't access pages they shouldn't
 */

describe('RBAC Utilities', () => {
  describe('ROUTE_PERMISSIONS mapping', () => {
    it('should define permissions for all protected routes', () => {
      expect(ROUTE_PERMISSIONS).toBeDefined();
      expect(Object.keys(ROUTE_PERMISSIONS).length).toBeGreaterThan(0);
    });

    it('should define public routes with empty role arrays', () => {
      expect(ROUTE_PERMISSIONS['/']).toEqual([]);
      expect(ROUTE_PERMISSIONS['/demo']).toEqual([]);
      expect(ROUTE_PERMISSIONS['/demo/personas']).toEqual([]);
    });

    it('should restrict workflows to account_admin and super_admin only', () => {
      expect(ROUTE_PERMISSIONS['/workflows']).toEqual(['account_admin', 'super_admin']);
      expect(ROUTE_PERMISSIONS['/workflow-designer/:templateId']).toEqual(['account_admin', 'super_admin']);
    });

    it('should restrict admin routes to super_admin only', () => {
      expect(ROUTE_PERMISSIONS['/admin/management-companies']).toEqual(['super_admin']);
      expect(ROUTE_PERMISSIONS['/admin/communities']).toEqual(['super_admin']);
      expect(ROUTE_PERMISSIONS['/admin/ai-activity']).toEqual(['super_admin']);
      expect(ROUTE_PERMISSIONS['/admin/demo-codes']).toEqual(['super_admin']);
    });

    it('should allow all authenticated users to access dashboard', () => {
      const dashboardRoles = ROUTE_PERMISSIONS['/dashboard'];
      expect(dashboardRoles).toContain('homeowner');
      expect(dashboardRoles).toContain('poa_board_contributor');
      expect(dashboardRoles).toContain('poa_board_member');
      expect(dashboardRoles).toContain('management_manager');
      expect(dashboardRoles).toContain('super_admin');
    });
  });

  describe('hasRoutePermission', () => {
    describe('Super Admin Access', () => {
      it('should grant super admins access to all routes', () => {
        expect(hasRoutePermission('/workflows', 'homeowner', true)).toBe(true);
        expect(hasRoutePermission('/admin/management-companies', 'poa_board_member', true)).toBe(true);
        expect(hasRoutePermission('/compliance', 'homeowner', true)).toBe(true);
      });

      it('should grant super admins access regardless of role parameter', () => {
        expect(hasRoutePermission('/workflows', null, true)).toBe(true);
        expect(hasRoutePermission('/admin/communities', undefined, true)).toBe(true);
      });
    });

    describe('Public Routes', () => {
      it('should allow anyone to access public routes without authentication', () => {
        expect(hasRoutePermission('/', null)).toBe(true);
        expect(hasRoutePermission('/demo', null)).toBe(true);
        expect(hasRoutePermission('/demo/personas', null)).toBe(true);
        expect(hasRoutePermission('/upload/abc123', null)).toBe(true);
      });

      it('should allow authenticated users to access public routes', () => {
        expect(hasRoutePermission('/', 'homeowner')).toBe(true);
        expect(hasRoutePermission('/demo', 'poa_board_member')).toBe(true);
      });
    });

    describe('Protected Routes - Workflows', () => {
      it('should deny homeowner access to workflows', () => {
        expect(hasRoutePermission('/workflows', 'homeowner')).toBe(false);
      });

      it('should deny poa_board_member access to workflows', () => {
        expect(hasRoutePermission('/workflows', 'poa_board_member')).toBe(false);
      });

      it('should deny management_rep access to workflows', () => {
        expect(hasRoutePermission('/workflows', 'management_rep')).toBe(false);
      });

      it('should deny management_manager access to workflows', () => {
        expect(hasRoutePermission('/workflows', 'management_manager')).toBe(false);
      });

      it('should allow account_admin access to workflows', () => {
        expect(hasRoutePermission('/workflows', 'account_admin')).toBe(true);
      });

      it('should allow super_admin role (non-flag) access to workflows', () => {
        expect(hasRoutePermission('/workflows', 'super_admin')).toBe(true);
      });
    });

    describe('Protected Routes - Compliance', () => {
      it('should deny homeowner access to compliance', () => {
        expect(hasRoutePermission('/compliance', 'homeowner')).toBe(false);
      });

      it('should deny poa_board_member access to compliance', () => {
        expect(hasRoutePermission('/compliance', 'poa_board_member')).toBe(false);
      });

      it('should deny management_rep access to compliance', () => {
        expect(hasRoutePermission('/compliance', 'management_rep')).toBe(false);
      });

      it('should allow management_manager access to compliance', () => {
        expect(hasRoutePermission('/compliance', 'management_manager')).toBe(true);
      });

      it('should allow super_admin access to compliance', () => {
        expect(hasRoutePermission('/compliance', 'super_admin')).toBe(true);
      });
    });

    describe('Protected Routes - Properties', () => {
      it('should deny homeowner access to properties', () => {
        expect(hasRoutePermission('/properties', 'homeowner')).toBe(false);
      });

      it('should deny poa_board_member access to properties', () => {
        expect(hasRoutePermission('/properties', 'poa_board_member')).toBe(false);
      });

      it('should allow management_rep access to properties', () => {
        expect(hasRoutePermission('/properties', 'management_rep')).toBe(true);
      });

      it('should allow management_manager access to properties', () => {
        expect(hasRoutePermission('/properties', 'management_manager')).toBe(true);
      });

      it('should allow account_admin access to properties', () => {
        expect(hasRoutePermission('/properties', 'account_admin')).toBe(true);
      });
    });

    describe('Protected Routes - Directory', () => {
      it('should deny homeowner access to directory', () => {
        expect(hasRoutePermission('/directory', 'homeowner')).toBe(false);
      });

      it('should allow poa_board_contributor access to directory', () => {
        expect(hasRoutePermission('/directory', 'poa_board_contributor')).toBe(true);
      });

      it('should allow poa_board_member access to directory', () => {
        expect(hasRoutePermission('/directory', 'poa_board_member')).toBe(true);
      });

      it('should allow all management roles access to directory', () => {
        expect(hasRoutePermission('/directory', 'management_rep')).toBe(true);
        expect(hasRoutePermission('/directory', 'management_manager')).toBe(true);
      });
    });

    describe('Protected Routes - Form Builder', () => {
      it('should deny homeowner access to form builder', () => {
        expect(hasRoutePermission('/admin/form-builder', 'homeowner')).toBe(false);
      });

      it('should deny poa_board_member access to form builder', () => {
        expect(hasRoutePermission('/admin/form-builder', 'poa_board_member')).toBe(false);
      });

      it('should deny management_manager access to form builder', () => {
        expect(hasRoutePermission('/admin/form-builder', 'management_manager')).toBe(false);
      });

      it('should allow account_admin access to form builder', () => {
        expect(hasRoutePermission('/admin/form-builder', 'account_admin')).toBe(true);
      });

      it('should allow super_admin access to form builder', () => {
        expect(hasRoutePermission('/admin/form-builder', 'super_admin')).toBe(true);
      });
    });

    describe('Protected Routes - Settings', () => {
      it('should deny homeowner access to settings', () => {
        expect(hasRoutePermission('/settings', 'homeowner')).toBe(false);
      });

      it('should allow poa_board_member access to settings', () => {
        expect(hasRoutePermission('/settings', 'poa_board_member')).toBe(true);
      });

      it('should allow management_manager access to settings', () => {
        expect(hasRoutePermission('/settings', 'management_manager')).toBe(true);
      });

      it('should allow account_admin access to settings', () => {
        expect(hasRoutePermission('/settings', 'account_admin')).toBe(true);
      });
    });

    describe('Protected Routes - Admin Pages', () => {
      it('should deny all non-super-admin roles from admin pages', () => {
        const adminRoutes = [
          '/admin/management-companies',
          '/admin/communities',
          '/admin/ai-activity',
          '/admin/demo-codes',
        ];

        const nonAdminRoles: Role[] = [
          'homeowner',
          'poa_board_contributor',
          'poa_board_member',
          'delegated_rep',
          'management_rep',
          'management_manager',
          'account_admin',
        ];

        adminRoutes.forEach(route => {
          nonAdminRoles.forEach(role => {
            expect(hasRoutePermission(route, role)).toBe(false);
          });
        });
      });

      it('should allow super_admin role to access all admin pages', () => {
        expect(hasRoutePermission('/admin/management-companies', 'super_admin')).toBe(true);
        expect(hasRoutePermission('/admin/communities', 'super_admin')).toBe(true);
        expect(hasRoutePermission('/admin/ai-activity', 'super_admin')).toBe(true);
        expect(hasRoutePermission('/admin/demo-codes', 'super_admin')).toBe(true);
      });
    });

    describe('Dynamic Route Patterns', () => {
      it('should match dynamic application detail routes', () => {
        expect(hasRoutePermission('/applications/123', 'homeowner')).toBe(true);
        expect(hasRoutePermission('/applications/abc-def-456', 'poa_board_member')).toBe(true);
      });

      it('should match dynamic application edit routes', () => {
        expect(hasRoutePermission('/applications/123/edit', 'homeowner')).toBe(true);
        expect(hasRoutePermission('/applications/abc-def-456/edit', 'management_manager')).toBe(true);
      });

      it('should match dynamic form builder routes', () => {
        expect(hasRoutePermission('/form-builder/template-1', 'account_admin')).toBe(true);
        expect(hasRoutePermission('/form-builder/abc-123', 'super_admin')).toBe(true);
        expect(hasRoutePermission('/form-builder/template-1', 'homeowner')).toBe(false);
      });

      it('should match dynamic workflow designer routes', () => {
        expect(hasRoutePermission('/workflow-designer/template-1', 'account_admin')).toBe(true);
        expect(hasRoutePermission('/workflow-designer/abc-123', 'super_admin')).toBe(true);
        expect(hasRoutePermission('/workflow-designer/template-1', 'management_manager')).toBe(false);
      });

      it('should match dynamic property subscription routes', () => {
        expect(hasRoutePermission('/properties/prop-123/subscription', 'management_rep')).toBe(true);
        expect(hasRoutePermission('/properties/abc-def/subscription', 'management_manager')).toBe(true);
        expect(hasRoutePermission('/properties/prop-123/subscription', 'homeowner')).toBe(false);
      });

      it('should match dynamic upload token routes', () => {
        expect(hasRoutePermission('/upload/abc123', null)).toBe(true);
        expect(hasRoutePermission('/upload/token-456-def', null)).toBe(true);
      });

      it('should match dynamic application submit routes', () => {
        expect(hasRoutePermission('/applications/submit/type-1', 'homeowner')).toBe(true);
        expect(hasRoutePermission('/applications/submit/abc-def', 'poa_board_member')).toBe(true);
      });

      it('should match dynamic demo code routes', () => {
        expect(hasRoutePermission('/admin/demo-codes/123', 'super_admin')).toBe(true);
        expect(hasRoutePermission('/admin/demo-codes/new', 'super_admin')).toBe(true);
        expect(hasRoutePermission('/admin/demo-codes/abc-def', 'account_admin')).toBe(false);
      });
    });

    describe('Unauthenticated Access', () => {
      it('should deny access to protected routes without authentication', () => {
        expect(hasRoutePermission('/dashboard', null)).toBe(false);
        expect(hasRoutePermission('/applications', null)).toBe(false);
        expect(hasRoutePermission('/workflows', null)).toBe(false);
        expect(hasRoutePermission('/properties', null)).toBe(false);
      });

      it('should deny access to protected routes with undefined role', () => {
        expect(hasRoutePermission('/dashboard', undefined)).toBe(false);
        expect(hasRoutePermission('/applications', undefined)).toBe(false);
      });
    });

    describe('Unknown Routes', () => {
      it('should deny access to unmapped routes', () => {
        expect(hasRoutePermission('/unknown-route', 'homeowner')).toBe(false);
        expect(hasRoutePermission('/random/path', 'poa_board_member')).toBe(false);
        expect(hasRoutePermission('/not/defined', 'super_admin', false)).toBe(false);
      });

      it('should allow super admin flag to override unmapped route denial', () => {
        expect(hasRoutePermission('/unknown-route', 'homeowner', true)).toBe(true);
        expect(hasRoutePermission('/random/path', null, true)).toBe(true);
      });
    });

    describe('Dashboard and Common Routes', () => {
      it('should allow all authenticated users to access dashboard', () => {
        const allRoles: Role[] = [
          'homeowner',
          'poa_board_contributor',
          'poa_board_member',
          'delegated_rep',
          'management_rep',
          'management_manager',
          'account_admin',
          'super_admin',
        ];

        allRoles.forEach(role => {
          expect(hasRoutePermission('/dashboard', role)).toBe(true);
        });
      });

      it('should allow all authenticated users to access applications', () => {
        const allRoles: Role[] = [
          'homeowner',
          'poa_board_contributor',
          'poa_board_member',
          'delegated_rep',
          'management_rep',
          'management_manager',
          'account_admin',
          'super_admin',
        ];

        allRoles.forEach(role => {
          expect(hasRoutePermission('/applications', role)).toBe(true);
        });
      });

      it('should allow all authenticated users to access profile', () => {
        expect(hasRoutePermission('/profile', 'homeowner')).toBe(true);
        expect(hasRoutePermission('/profile', 'poa_board_member')).toBe(true);
        expect(hasRoutePermission('/profile', 'management_manager')).toBe(true);
      });
    });

    describe('Apply Routes', () => {
      it('should allow homeowners to submit applications', () => {
        expect(hasRoutePermission('/apply', 'homeowner')).toBe(true);
        expect(hasRoutePermission('/apply/markland-demo', 'homeowner')).toBe(true);
      });

      it('should allow board members to submit applications', () => {
        expect(hasRoutePermission('/apply', 'poa_board_member')).toBe(true);
        expect(hasRoutePermission('/apply/markland-demo', 'poa_board_contributor')).toBe(true);
      });

      it('should deny management roles from submitting applications', () => {
        expect(hasRoutePermission('/apply', 'management_rep')).toBe(false);
        expect(hasRoutePermission('/apply', 'management_manager')).toBe(false);
        expect(hasRoutePermission('/apply/markland-demo', 'management_rep')).toBe(false);
      });
    });
  });

  describe('getUnauthorizedMessage', () => {
    it('should return generic message for unmapped routes', () => {
      const message = getUnauthorizedMessage('/unknown-route', 'homeowner');
      expect(message).toContain('does not exist');
      expect(message).toContain('do not have permission');
    });

    it('should return login message for unauthenticated users', () => {
      const message = getUnauthorizedMessage('/dashboard', null);
      expect(message).toContain('must be logged in');
    });

    it('should list required roles for protected routes', () => {
      const message = getUnauthorizedMessage('/workflows', 'homeowner');
      expect(message).toContain('Account Admin');
      expect(message).toContain('Super Admin');
    });

    it('should format role names correctly', () => {
      const message = getUnauthorizedMessage('/properties', 'homeowner');
      expect(message).toContain('Management Rep');
      expect(message).toContain('Management Manager');
    });

    it('should work with dynamic routes', () => {
      const message = getUnauthorizedMessage('/form-builder/template-1', 'homeowner');
      expect(message).toContain('Account Admin');
      expect(message).toContain('Super Admin');
    });

    it('should handle admin routes correctly', () => {
      const message = getUnauthorizedMessage('/admin/management-companies', 'account_admin');
      expect(message).toContain('Super Admin');
    });
  });
});
