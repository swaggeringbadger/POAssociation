/**
 * Floating Help Button Component
 *
 * A floating button in the bottom-right corner that allows users
 * to reopen the tour for the current page. Only visible if the
 * current page has a tour for the user's role.
 */

import { useLocation } from 'wouter';
import { useAppStore } from '@/lib/store';
import { useTour } from './TourProvider';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { hasTourForRole, getPageKeyFromPath, Role } from '@/lib/tour';

export function FloatingHelpButton() {
  const [location] = useLocation();
  const { currentUserRole } = useAppStore();
  const { openTour, isOpen, isLoading } = useTour();

  // Get the current page key from the URL
  const pageKey = getPageKeyFromPath(location);

  // Don't show if:
  // - Loading tour data
  // - Tour modal is already open
  // - No page key found
  // - No role
  // - No tour exists for this page/role
  if (
    isLoading ||
    isOpen ||
    !pageKey ||
    !currentUserRole ||
    !hasTourForRole(pageKey, currentUserRole as Role)
  ) {
    return null;
  }

  const handleClick = () => {
    openTour(pageKey);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
              onClick={handleClick}
            >
              <HelpCircle className="h-6 w-6" />
              <span className="sr-only">Show page tour</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            <p>Show page tour</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
