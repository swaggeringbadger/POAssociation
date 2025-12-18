/**
 * Tour Provider Component
 *
 * Provides tour context to the entire dashboard, managing tour state
 * and checking/showing tours based on the current page and role.
 * Supports admin-customized content via database overrides.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import {
  getTourProgressList,
  markTourComplete,
  resetTourProgress as apiResetTourProgress,
  getTourContentOverrides,
  TourProgress,
  TourContentOverride,
} from '@/lib/api';
import {
  TourContextType,
  TourContent,
  Role,
  getTourProgressKey,
  getTourForPageAndRole,
  hasTourForRole,
  getPageKeyFromPath,
  getTourIcon,
} from '@/lib/tour';

// Default context value
const defaultContext: TourContextType = {
  isOpen: false,
  currentPageKey: null,
  currentStepIndex: 0,
  completedTours: new Set(),
  isLoading: true,
  currentTour: null,
  openTour: () => {},
  closeTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  completeTour: async () => {},
  checkAndShowTour: () => {},
  resetTour: async () => {},
};

const TourContext = createContext<TourContextType>(defaultContext);

export function useTour() {
  return useContext(TourContext);
}

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [location] = useLocation();
  const { currentUserRole } = useAppStore();
  const queryClient = useQueryClient();

  // Local state
  const [isOpen, setIsOpen] = useState(false);
  const [currentPageKey, setCurrentPageKey] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set());

  // Fetch all tour progress for the user
  const { data: tourProgressList, isLoading: progressLoading } = useQuery({
    queryKey: ['tour-progress'],
    queryFn: getTourProgressList,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch tour content overrides (admin customizations)
  const { data: tourOverrides, isLoading: overridesLoading } = useQuery({
    queryKey: ['tour-content'],
    queryFn: getTourContentOverrides,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isLoading = progressLoading || overridesLoading;

  // Create a map of overrides for quick lookup
  const overridesMap = useMemo(() => {
    const map = new Map<string, TourContentOverride>();
    if (tourOverrides) {
      for (const override of tourOverrides) {
        const key = getTourProgressKey(override.pageKey, override.role);
        map.set(key, override);
      }
    }
    return map;
  }, [tourOverrides]);

  // Update completed tours when data changes
  useEffect(() => {
    if (tourProgressList) {
      const completed = new Set(
        tourProgressList.map((p: TourProgress) => getTourProgressKey(p.pageKey, p.role))
      );
      setCompletedTours(completed);
    }
  }, [tourProgressList]);

  // Mark tour completed mutation
  const completeTourMutation = useMutation({
    mutationFn: ({ pageKey, role }: { pageKey: string; role: string }) =>
      markTourComplete(pageKey, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-progress'] });
    },
  });

  // Reset tour mutation
  const resetTourMutation = useMutation({
    mutationFn: ({ pageKey, role }: { pageKey?: string; role?: string }) =>
      apiResetTourProgress(pageKey, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-progress'] });
    },
  });

  /**
   * Get active tour content for a page/role, considering overrides
   * Returns null if tour is disabled or doesn't exist
   */
  const getActiveTour = useCallback(
    (pageKey: string, role: Role): TourContent | null => {
      const overrideKey = getTourProgressKey(pageKey, role);
      const override = overridesMap.get(overrideKey);

      // If there's an override, use it
      if (override) {
        // Check if disabled
        if (!override.isEnabled) {
          return null;
        }

        // Convert override to TourContent
        return {
          pageKey: override.pageKey,
          pageTitle: override.pageTitle,
          roles: [role],
          steps: override.steps.map(step => ({
            title: step.title,
            description: step.description,
            icon: getTourIcon(step.iconName),
          })),
        };
      }

      // Fall back to TypeScript default
      return getTourForPageAndRole(pageKey, role);
    },
    [overridesMap]
  );

  /**
   * Check if a tour exists and is enabled for a page/role
   */
  const hasTour = useCallback(
    (pageKey: string, role: Role): boolean => {
      const overrideKey = getTourProgressKey(pageKey, role);
      const override = overridesMap.get(overrideKey);

      // If there's an override, check if it's enabled
      if (override) {
        return override.isEnabled;
      }

      // Fall back to checking TypeScript defaults
      return hasTourForRole(pageKey, role);
    },
    [overridesMap]
  );

  // Get current tour content
  const currentTour = useMemo(() => {
    if (!currentPageKey || !currentUserRole) return null;
    return getActiveTour(currentPageKey, currentUserRole as Role);
  }, [currentPageKey, currentUserRole, getActiveTour]);

  // Check if we should show tour for current page
  const checkAndShowTour = useCallback(
    (pageKey: string, role: Role) => {
      // Check if tour exists and is enabled for this page/role
      if (!hasTour(pageKey, role)) {
        return;
      }

      // Check if already completed
      const progressKey = getTourProgressKey(pageKey, role);
      if (completedTours.has(progressKey)) {
        return;
      }

      // Show the tour
      setCurrentPageKey(pageKey);
      setCurrentStepIndex(0);
      setIsOpen(true);
    },
    [completedTours, hasTour]
  );

  // Auto-check when location or role changes
  useEffect(() => {
    if (isLoading || !currentUserRole) return;

    const pageKey = getPageKeyFromPath(location);
    if (pageKey) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        checkAndShowTour(pageKey, currentUserRole as Role);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location, currentUserRole, isLoading, checkAndShowTour]);

  // Actions
  const openTour = useCallback((pageKey: string) => {
    setCurrentPageKey(pageKey);
    setCurrentStepIndex(0);
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
  }, []);

  const nextStep = useCallback(() => {
    if (currentTour && currentStepIndex < currentTour.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentTour, currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const completeTour = useCallback(async () => {
    if (!currentPageKey || !currentUserRole) return;

    // Mark as completed in local state immediately
    const progressKey = getTourProgressKey(currentPageKey, currentUserRole);
    setCompletedTours(prev => new Set([...Array.from(prev), progressKey]));

    // Close the modal
    setIsOpen(false);

    // Mark as completed on server
    await completeTourMutation.mutateAsync({
      pageKey: currentPageKey,
      role: currentUserRole,
    });
  }, [currentPageKey, currentUserRole, completeTourMutation]);

  const resetTour = useCallback(
    async (pageKey?: string, role?: string) => {
      // Remove from local state
      if (pageKey && role) {
        const progressKey = getTourProgressKey(pageKey, role);
        setCompletedTours(prev => {
          const next = new Set(prev);
          next.delete(progressKey);
          return next;
        });
      } else {
        setCompletedTours(new Set());
      }

      // Reset on server
      await resetTourMutation.mutateAsync({ pageKey, role });
    },
    [resetTourMutation]
  );

  const contextValue: TourContextType = {
    isOpen,
    currentPageKey,
    currentStepIndex,
    completedTours,
    isLoading,
    currentTour,
    openTour,
    closeTour,
    nextStep,
    prevStep,
    completeTour,
    checkAndShowTour,
    resetTour,
  };

  return (
    <TourContext.Provider value={contextValue}>
      {children}
    </TourContext.Provider>
  );
}
