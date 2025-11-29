/**
 * RBAC (Role-Based Access Control) Utilities
 *
 * Centralized permission checking to prevent unauthorized access to routes and features
 */

import type { Role } from './mock-data';

// Route permission mapping - defines which roles can access each route
export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  // Public routes (no auth required)
  '/': [],
  '/demo': [],
  '/demo/personas': [],
  '/upload/:token': [],

  // Dashboard - all authenticated users
  '/dashboard': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member',
    'delegated_rep',
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],

  // Applications - all authenticated users
  '/applications': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member',
    'delegated_rep',
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],
  '/applications/:id': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member',
    'delegated_rep',
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],
  '/applications/:id/edit': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member',
    'delegated_rep',
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],
  '/applications/submit/:typeId': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member',
    'delegated_rep',
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],

  // Submit Request - homeowners and board members
  '/apply': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member'
  ],
  '/apply/markland-demo': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member'
  ],

  // Directory - board members and management
  '/directory': [
    'poa_board_contributor',
    'poa_board_member',
    'delegated_rep',
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],

  // Properties - management only
  '/properties': [
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],
  '/properties/:propertyId/subscription': [
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],

  // Compliance - management managers and super admins
  '/compliance': [
    'management_manager',
    'super_admin'
  ],

  // Calendar - all authenticated users
  '/calendar': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member',
    'delegated_rep',
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],

  // Form Wizard - board members and management
  '/form-wizard': [
    'poa_board_member',
    'management_manager',
    'account_admin',
    'super_admin'
  ],

  // Form Builder - account admins and super admins
  '/admin/form-builder': [
    'account_admin',
    'super_admin'
  ],
  '/form-builder/:templateId': [
    'account_admin',
    'super_admin'
  ],

  // Workflows - account admins and super admins only
  '/workflows': [
    'account_admin',
    'super_admin'
  ],
  '/workflow-designer/:templateId': [
    'account_admin',
    'super_admin'
  ],

  // Settings - board members and management
  '/settings': [
    'poa_board_member',
    'management_manager',
    'account_admin',
    'super_admin'
  ],

  // Profile - all authenticated users
  '/profile': [
    'homeowner',
    'poa_board_contributor',
    'poa_board_member',
    'delegated_rep',
    'management_rep',
    'management_manager',
    'account_admin',
    'super_admin'
  ],

  // Admin Routes - super admin only
  '/admin/management-companies': ['super_admin'],
  '/admin/communities': ['super_admin'],
  '/admin/ai-activity': ['super_admin'],
  '/admin/demo-codes': ['super_admin'],
  '/admin/demo-codes/:id': ['super_admin'],
};

/**
 * Check if a user role has permission to access a specific route
 */
export function hasRoutePermission(
  route: string,
  userRole: Role | null | undefined,
  isSuperAdmin: boolean = false
): boolean {
  // Super admins have access to everything
  if (isSuperAdmin) {
    return true;
  }

  // If no role, deny access (except for public routes)
  if (!userRole) {
    const publicRoutes = ['/', '/demo', '/demo/personas'];
    return publicRoutes.includes(route) || route.startsWith('/upload/');
  }

  // Find matching route pattern
  const matchingPattern = findMatchingRoutePattern(route);

  // If no matching pattern found, deny access by default
  if (!matchingPattern) {
    return false;
  }

  const allowedRoles = ROUTE_PERMISSIONS[matchingPattern];

  // If route has no restrictions, allow
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  // Check if user's role is in the allowed roles
  return allowedRoles.includes(userRole);
}

/**
 * Find matching route pattern for a given route
 * Handles dynamic segments like :id, :templateId, etc.
 */
function findMatchingRoutePattern(route: string): string | null {
  // First try exact match
  if (ROUTE_PERMISSIONS[route]) {
    return route;
  }

  // Try pattern matching for dynamic routes
  const patterns = Object.keys(ROUTE_PERMISSIONS);

  for (const pattern of patterns) {
    if (matchesRoutePattern(route, pattern)) {
      return pattern;
    }
  }

  return null;
}

/**
 * Check if a route matches a pattern with dynamic segments
 * e.g., /applications/123 matches /applications/:id
 */
function matchesRoutePattern(route: string, pattern: string): boolean {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/:[^/]+/g, '[^/]+') // Replace :param with regex
    .replace(/\//g, '\\/');       // Escape slashes

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(route);
}

/**
 * Get human-readable message for unauthorized access
 */
export function getUnauthorizedMessage(route: string, userRole: Role | null | undefined): string {
  const matchingPattern = findMatchingRoutePattern(route);

  if (!matchingPattern) {
    return 'This page does not exist or you do not have permission to access it.';
  }

  const allowedRoles = ROUTE_PERMISSIONS[matchingPattern];

  if (!userRole) {
    return 'You must be logged in to access this page.';
  }

  const roleNames = allowedRoles.map(role => role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');

  return `This page is only accessible to users with the following roles: ${roleNames}`;
}
