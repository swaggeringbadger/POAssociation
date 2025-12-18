/**
 * Tour System Exports
 *
 * Central export for tour types, registry, and utilities.
 */

// Types
export * from './types';

// Registry
export {
  getTourForPageAndRole,
  hasTourForRole,
  getPagesWithToursForRole,
  getToursForPage,
  getPageKeyFromPath,
  getAllToursFlattened,
  allTours,
} from './registry';
export type { FlattenedTour } from './registry';

// Icon Registry
export {
  TOUR_ICONS,
  TOUR_ICON_OPTIONS,
  TOUR_ICON_GROUPS,
  getTourIcon,
  isValidIconName,
} from './iconRegistry';
export type { TourIconName } from './iconRegistry';
