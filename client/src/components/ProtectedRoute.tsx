/**
 * ProtectedRoute Component
 *
 * Enforces authentication and RBAC (Role-Based Access Control) on routes.
 * - First checks if user is authenticated (redirects to landing if not)
 * - Then checks RBAC permissions for the specific route
 */

import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { hasRoutePermission, getUnauthorizedMessage } from '@/lib/rbac';
import type { Role } from '@/lib/mock-data';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  fallbackPath?: string;
}

/**
 * Wrapper component that checks authentication and RBAC permissions before rendering children.
 * If user is not authenticated, redirects to landing page.
 * If user lacks permission, shows an unauthorized message.
 */
export function ProtectedRoute({ children, fallbackPath = '/dashboard' }: ProtectedRouteProps) {
  const [location, setLocation] = useLocation();
  const currentUserRole = useAppStore(state => state.currentUserRole) as Role;

  // Check authentication status
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Check if user is super admin
  const { data: superAdminData, isLoading: isSuperAdminLoading } = useQuery({
    queryKey: ['/api/auth/is-super-admin'],
    queryFn: () => api.isSuperAdmin(),
    retry: false,
    enabled: isAuthenticated, // Only check super admin if authenticated
  });

  const isSuperAdmin = superAdminData?.isSuperAdmin ?? false;
  const isLoading = isAuthLoading || (isAuthenticated && isSuperAdminLoading);

  // Redirect to landing page if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      // Redirect to landing page - the user's session has expired or they're not logged in
      setLocation('/');
    }
  }, [isAuthLoading, isAuthenticated, setLocation]);

  // Show loading state while checking auth/permissions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (useEffect will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Check if user has permission to access this route
  const hasPermission = hasRoutePermission(location, currentUserRole, isSuperAdmin);

  // If authorized, render the protected content
  if (hasPermission) {
    return <>{children}</>;
  }

  // If not authorized, show unauthorized message
  const unauthorizedMessage = getUnauthorizedMessage(location, currentUserRole);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            {unauthorizedMessage}
          </p>
        </div>

        <div className="pt-4">
          <Button
            className="gap-2"
            onClick={() => window.location.href = fallbackPath}
          >
            <Home className="h-4 w-4" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
