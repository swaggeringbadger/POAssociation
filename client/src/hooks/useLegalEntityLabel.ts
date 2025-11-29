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

/**
 * Role display name mapping.
 * Keys with {entity} will have it replaced with POA/HOA based on tenant settings.
 */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  homeowner: "Homeowner",
  delegated_rep: "Delegated Representative",
  poa_board_member: "{entity} Board Member",
  poa_board_contributor: "{entity} Board Contributor",
  hoa_board_member: "{entity} Board Member",
  management_rep: "Management Representative",
  management_manager: "Management Manager",
  management_employee: "Management Employee",
  account_admin: "Account Administrator",
  super_admin: "Super Administrator",
};

/**
 * Formats a role key into a human-readable display name.
 * Respects POA/HOA tenant setting for board roles.
 */
export function formatRoleLabel(role: string, tenant: any | null | undefined): string {
  const template = ROLE_DISPLAY_NAMES[role];
  if (template) {
    const entityLabel = getLegalEntityLabel(tenant);
    return template.replace("{entity}", entityLabel);
  }
  // Fallback: Convert snake_case to Title Case
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Hook that returns a function to format role labels.
 * Use this in components to display user-friendly role names.
 */
export function useFormatRoleLabel(): (role: string) => string {
  const { currentTenant } = useAppStore();
  return (role: string) => formatRoleLabel(role, currentTenant);
}
