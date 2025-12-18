/**
 * Tour Registry
 *
 * Central registry for all tour content. Import tour content from
 * the content/ directory and register it here.
 */

import { TourContent, Role } from './types';

// Import all tour content
import { dashboardTours } from './content/dashboard';
import { applicationsTours } from './content/applications';
import { calendarTours } from './content/calendar';
import { directoryTours } from './content/directory';
import { propertiesTours } from './content/properties';
import { settingsTours } from './content/settings';
import { billingTours } from './content/billing';
import { complianceTours } from './content/compliance';
import { teamTours } from './content/team';
import { workflowsTours } from './content/workflows';

// All registered tours - DISABLED: Tours need improvement before re-enabling
// To re-enable, uncomment the tour arrays below
const allTours: TourContent[] = [
  // ...dashboardTours,
  // ...applicationsTours,
  // ...calendarTours,
  // ...directoryTours,
  // ...propertiesTours,
  // ...settingsTours,
  // ...billingTours,
  // ...complianceTours,
  // ...teamTours,
  // ...workflowsTours,
];

/**
 * Get a tour for a specific page and role
 * Returns null if no tour exists for that combination
 */
export function getTourForPageAndRole(pageKey: string, role: Role): TourContent | null {
  const tour = allTours.find(
    t => t.pageKey === pageKey && t.roles.includes(role)
  );
  return tour || null;
}

/**
 * Check if a page has a tour for a given role
 */
export function hasTourForRole(pageKey: string, role: Role): boolean {
  return allTours.some(t => t.pageKey === pageKey && t.roles.includes(role));
}

/**
 * Get all pages that have tours for a given role
 */
export function getPagesWithToursForRole(role: Role): string[] {
  const pages = new Set<string>();
  allTours.forEach(tour => {
    if (tour.roles.includes(role)) {
      pages.add(tour.pageKey);
    }
  });
  return Array.from(pages);
}

/**
 * Get all tours for a given page (across all roles)
 */
export function getToursForPage(pageKey: string): TourContent[] {
  return allTours.filter(t => t.pageKey === pageKey);
}

/**
 * Map URL path to page key
 * Handles both exact matches and pattern matching
 */
export function getPageKeyFromPath(pathname: string): string | null {
  // Remove leading slash and any trailing slashes
  const cleanPath = pathname.replace(/^\/|\/$/g, '');

  // Direct mapping for common routes
  const pathMappings: Record<string, string> = {
    '': 'dashboard',
    'dashboard': 'dashboard',
    'applications': 'applications',
    'calendar': 'calendar',
    'directory': 'directory',
    'properties': 'properties',
    'settings': 'settings',
    'billing': 'billing',
    'compliance': 'compliance',
    'team': 'team',
    'workflows': 'workflows',
    'help': 'help',
  };

  if (pathMappings[cleanPath]) {
    return pathMappings[cleanPath];
  }

  // Pattern matching for nested routes
  // e.g., /applications/123 -> applications
  const firstSegment = cleanPath.split('/')[0];
  if (pathMappings[firstSegment]) {
    return pathMappings[firstSegment];
  }

  return null;
}

// Export the full registry for debugging
export { allTours };

/**
 * Interface for flattened tour entry (one per page+role combination)
 * Used by admin interface
 */
export interface FlattenedTour {
  pageKey: string;
  role: Role;
  pageTitle: string;
  steps: Array<{
    title: string;
    description: string;
    iconName: string;  // Icon component name as string
  }>;
}

/**
 * Get all tours flattened as individual page+role entries.
 * Each tour with multiple roles is split into separate entries.
 * Icons are converted to their string names for admin editing.
 */
export function getAllToursFlattened(): FlattenedTour[] {
  const flattened: FlattenedTour[] = [];

  for (const tour of allTours) {
    for (const role of tour.roles) {
      flattened.push({
        pageKey: tour.pageKey,
        role,
        pageTitle: tour.pageTitle,
        steps: tour.steps.map(step => ({
          title: step.title,
          description: step.description,
          iconName: step.icon.displayName || step.icon.name || 'HelpCircle',
        })),
      });
    }
  }

  // Sort by pageKey then role for consistent ordering
  return flattened.sort((a, b) => {
    if (a.pageKey !== b.pageKey) {
      return a.pageKey.localeCompare(b.pageKey);
    }
    return a.role.localeCompare(b.role);
  });
}
