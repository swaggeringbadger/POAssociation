import { useAppStore } from "@/lib/store";
import type { LegalEntityType } from "@shared/schema";

/**
 * Gets the legal entity type label (POA or HOA) for a tenant.
 * Falls back to 'POA' if not set.
 */
export function getLegalEntityLabel(tenant: any | null | undefined): string {
  if (!tenant) return "POA";
  const entityType = tenant.communitySettings?.legalEntityType;
  return entityType === "hoa" ? "HOA" : "POA";
}

/**
 * Gets the legal entity type (poa or hoa) for a tenant.
 * Falls back to 'poa' if not set.
 */
export function getLegalEntityType(tenant: any | null | undefined): LegalEntityType {
  if (!tenant) return "poa";
  return tenant.communitySettings?.legalEntityType || "poa";
}

/**
 * Gets the full legal entity label (e.g., "Property Owners Association" or "Homeowners Association")
 */
export function getLegalEntityFullLabel(tenant: any | null | undefined): string {
  const entityType = getLegalEntityType(tenant);
  return entityType === "hoa"
    ? "Homeowners Association"
    : "Property Owners Association";
}

/**
 * Hook that returns the legal entity label for the current tenant.
 * Use this when you need to display "POA" or "HOA" in the UI.
 */
export function useLegalEntityLabel(): string {
  const { currentTenant } = useAppStore();
  return getLegalEntityLabel(currentTenant);
}

/**
 * Hook that returns the legal entity type for the current tenant.
 * Returns 'poa' or 'hoa'.
 */
export function useLegalEntityType(): LegalEntityType {
  const { currentTenant } = useAppStore();
  return getLegalEntityType(currentTenant);
}

/**
 * Hook that returns the full legal entity label for the current tenant.
 */
export function useLegalEntityFullLabel(): string {
  const { currentTenant } = useAppStore();
  return getLegalEntityFullLabel(currentTenant);
}

/**
 * Replaces "POA" with the appropriate legal entity label in a string.
 * Also handles "poa" lowercase.
 */
export function replacePOALabel(text: string, tenant: any | null | undefined): string {
  const label = getLegalEntityLabel(tenant);
  return text
    .replace(/\bPOA\b/g, label)
    .replace(/\bpoa\b/g, label.toLowerCase());
}

/**
 * Hook that provides a function to replace POA labels in text.
 */
export function useReplacePOALabel(): (text: string) => string {
  const { currentTenant } = useAppStore();
  return (text: string) => replacePOALabel(text, currentTenant);
}
