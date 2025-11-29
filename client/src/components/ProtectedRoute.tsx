/**
 * ProtectedRoute Component
 *
 * Enforces RBAC (Role-Based Access Control) on routes
 * Prevents unauthorized users from accessing restricted pages
 */

import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { hasRoutePermission, getUnauthorizedMessage } from '@/lib/rbac';
import type { Role } from '@/lib/mock-data';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  fallbackPath?: string;
}

/**
 * Wrapper component that checks RBAC permissions before rendering children
 * If user lacks permission, shows an unauthorized message
 */
export function ProtectedRoute({ children, fallbackPath = '/dashboard' }: ProtectedRouteProps) {
  const [location] = useLocation();
  const currentUserRole = useAppStore(state => state.currentUserRole) as Role;

  // Check if user is super admin
  const { data: superAdminData, isLoading } = useQuery({
    queryKey: ['/api/auth/is-super-admin'],
    queryFn: () => api.isSuperAdmin(),
    retry: false,
  });

  const isSuperAdmin = superAdminData?.isSuperAdmin ?? false;

  // Show loading state while checking permissions
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
