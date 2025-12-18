/**
 * Tour System Types
 *
 * Defines the structure for role-specific page tours.
 */

import { LucideIcon } from 'lucide-react';

// All supported roles in the application
export type Role =
  | 'homeowner'
  | 'household_member'
  | 'poa_board_member'
  | 'management_rep'
  | 'management_manager'
  | 'account_admin'
  | 'contractor'
  | 'super_admin';

// A single step in a tour
export interface TourStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

// Complete tour content for a specific page/role combination
export interface TourContent {
  pageKey: string;        // Unique identifier: "dashboard", "applications", etc.
  pageTitle: string;      // Display title: "Welcome to Your Dashboard"
  roles: Role[];          // Which roles see this tour
  steps: TourStep[];      // 2-4 steps per tour
}

// Tour state for the provider
export interface TourState {
  isOpen: boolean;
  currentPageKey: string | null;
  currentStepIndex: number;
  completedTours: Set<string>;  // Set of "pageKey:role" strings
  isLoading: boolean;
}

// Tour context actions
export interface TourActions {
  openTour: (pageKey: string) => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  completeTour: () => Promise<void>;
  checkAndShowTour: (pageKey: string, role: Role) => void;
  resetTour: (pageKey?: string, role?: string) => Promise<void>;
}

// Combined tour context type
export interface TourContextType extends TourState, TourActions {
  currentTour: TourContent | null;
}

// Helper type for creating progress keys
export function getTourProgressKey(pageKey: string, role: string): string {
  return `${pageKey}:${role}`;
}
