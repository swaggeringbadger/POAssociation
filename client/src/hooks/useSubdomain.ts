import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";

/**
 * Hook to detect subdomain and auto-select tenant
 *
 * Usage:
 * - Production: markland.poassociation.com -> selects Markland tenant
 * - Testing: Add ?subdomain=markland to URL
 *
 * Returns:
 * - subdomain: The detected subdomain (or null)
 * - isSubdomainMode: Whether user accessed via subdomain
 */
export function useSubdomain() {
  const { availableTenants, setCurrentTenant, currentTenant } = useAppStore();

  // Check for subdomain from backend
  const { data: subdomainData } = useQuery({
    queryKey: ['/api/subdomain'],
    retry: false,
  });

  const subdomain = subdomainData?.subdomain || null;
  const isSubdomainMode = !!subdomain;

  // Auto-select tenant based on subdomain
  useEffect(() => {
    if (subdomain && availableTenants.length > 0) {
      const matchingTenant = availableTenants.find(
        (t) => t.subdomain.toLowerCase() === subdomain.toLowerCase()
      );

      if (matchingTenant && (!currentTenant || currentTenant.id !== matchingTenant.id)) {
        console.log('Auto-selecting tenant from subdomain:', subdomain);
        setCurrentTenant(matchingTenant);
      }
    }
  }, [subdomain, availableTenants, currentTenant, setCurrentTenant]);

  return {
    subdomain,
    isSubdomainMode,
  };
}
