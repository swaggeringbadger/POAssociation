/**
 * MeetingControls Component
 *
 * Controls for the meeting facilitator with visual state stepper,
 * focus navigation buttons, and start/end meeting controls.
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Play, Square, UserCog, Timer, LogOut, ChevronRight, ChevronLeft } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { claimFacilitator, releaseFacilitator, startMeeting, endMeeting } from '@/lib/api';
import type { CalendarEvent, User, MeetingAttendance, MeetingSectionCompletion, EventAgendaItemWithDetails } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type MeetingState = 'not_started' | 'roll_call' | 'in_progress' | 'wrapping_up' | 'ended';

interface MeetingControlsProps {
  event: CalendarEvent & {
    facilitatorUserId?: string;
    facilitatorClaimedAt?: string;
    meetingStartedAt?: string;
    meetingEndedAt?: string;
  };
  facilitator?: User;
  canEdit?: boolean;
  attendance?: MeetingAttendance[];
  completions?: MeetingSectionCompletion[];
  focusedItemId?: string | null;
  orderedItemIds?: string[];
  items?: EventAgendaItemWithDetails[];
  onFocusItem?: (itemId: string) => void;
  className?: string;
}

const MEETING_STEPS: { state: MeetingState; label: string }[] = [
  { state: 'not_started', label: 'Not Started' },
  { state: 'roll_call', label: 'Roll Call' },
  { state: 'in_progress', label: 'In Progress' },
  { state: 'wrapping_up', label: 'Wrapping Up' },
  { state: 'ended', label: 'Ended' },
];

export function MeetingControls({
  event,
  facilitator,
  canEdit = false,
  attendance = [],
  completions = [],
  focusedItemId,
  orderedItemIds = [],
  items = [],
  onFocusItem,
  className = '',
}: MeetingControlsProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

  const isFacilitator = user?.id === event.facilitatorUserId;
  const hasFacilitator = !!event.facilitatorUserId;
  const isMeetingStarted = !!event.meetingStartedAt && !event.meetingEndedAt;
  const isMeetingEnded = !!event.meetingEndedAt;

  // Derive meeting state
  const meetingState: MeetingState = useMemo(() => {
    if (event.meetingEndedAt) return 'ended';
    if (!event.meetingStartedAt) return 'not_started';

    // Check if all attendance is still 'expected' → roll call phase
    const allExpected = attendance.length > 0 && attendance.every(a => a.status === 'expected');
    if (allExpected) return 'roll_call';

    // Check if all sections are completed → wrapping up
    // We don't have total section count here, but if completions exist and seem high
    // We'll check if we have a good number of completions
    if (completions.length > 0) {
      // We check this heuristic: if completions >= 3 (most meetings have 5-9 sections)
      // A more exact approach would require passing sections count
      const allSectionsComplete = completions.length >= 5; // Most templates have 5+ sections
      if (allSectionsComplete) return 'wrapping_up';
    }

    return 'in_progress';
  }, [event.meetingStartedAt, event.meetingEndedAt, attendance, completions]);

  const currentStepIndex = MEETING_STEPS.findIndex(s => s.state === meetingState);

  // Get the focused item title for display
  const focusedItemTitle = useMemo(() => {
    if (!focusedItemId || !items.length) return null;
    const item = items.find(i => i.id === focusedItemId);
    if (!item) return null;
    return item.title || item.application?.title || item.application?.applicationNumber || 'Untitled';
  }, [focusedItemId, items]);

  // Update elapsed time every second when meeting is in progress
  useEffect(() => {
    if (!event.meetingStartedAt || event.meetingEndedAt) return;

    const startTime = new Date(event.meetingStartedAt).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const diff = now - startTime;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [event.meetingStartedAt, event.meetingEndedAt]);

  // Mutations with optimistic updates
  const claimMutation = useMutation({
    mutationFn: () => claimFacilitator(event.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', event.id] });
      const previousData = queryClient.getQueryData(['presentation-data', event.id]);

      queryClient.setQueryData(['presentation-data', event.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          event: {
            ...old.event,
            facilitatorUserId: user?.id,
            facilitatorClaimedAt: new Date().toISOString(),
          },
          facilitator: user,
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      toast.success("You are now the meeting facilitator");
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', event.id], context.previousData);
      }
      toast.error(`Failed to claim facilitator role: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', event.id] });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () => releaseFacilitator(event.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', event.id] });
      const previousData = queryClient.getQueryData(['presentation-data', event.id]);

      queryClient.setQueryData(['presentation-data', event.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          event: {
            ...old.event,
            facilitatorUserId: null,
            facilitatorClaimedAt: null,
          },
          facilitator: null,
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      toast.success("Facilitator role released");
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', event.id], context.previousData);
      }
      toast.error(`Failed to release facilitator role: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', event.id] });
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startMeeting(event.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', event.id] });
      const previousData = queryClient.getQueryData(['presentation-data', event.id]);

      queryClient.setQueryData(['presentation-data', event.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          event: {
            ...old.event,
            meetingStartedAt: new Date().toISOString(),
          },
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      toast.success("Meeting started");
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', event.id], context.previousData);
      }
      toast.error(`Failed to start meeting: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', event.id] });
    },
  });

  const endMutation = useMutation({
    mutationFn: () => endMeeting(event.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', event.id] });
      const previousData = queryClient.getQueryData(['presentation-data', event.id]);

      queryClient.setQueryData(['presentation-data', event.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          event: {
            ...old.event,
            meetingEndedAt: new Date().toISOString(),
          },
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      toast.success("Meeting ended");
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', event.id], context.previousData);
      }
      toast.error(`Failed to end meeting: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', event.id] });
    },
  });

  const getInitials = (user: User | undefined) => {
    if (!user) return '??';
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || '??';
  };

  // Focus navigation helpers
  const handleNextItem = () => {
    if (orderedItemIds.length === 0 || !onFocusItem) return;
    const currentIdx = focusedItemId ? orderedItemIds.indexOf(focusedItemId) : -1;
    const nextIdx = currentIdx < orderedItemIds.length - 1 ? currentIdx + 1 : 0;
    onFocusItem(orderedItemIds[nextIdx]);
  };

  const handlePrevItem = () => {
    if (orderedItemIds.length === 0 || !onFocusItem) return;
    const currentIdx = focusedItemId ? orderedItemIds.indexOf(focusedItemId) : 0;
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : orderedItemIds.length - 1;
    onFocusItem(orderedItemIds[prevIdx]);
  };

  return (
    <Card className={`print:hidden meeting-controls-card ${className}`}>
      <CardContent className="p-4 space-y-4">
        {/* Meeting State Stepper */}
        <div className="flex items-center justify-center gap-1 overflow-x-auto py-1">
          {MEETING_STEPS.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            const isComplete = idx < currentStepIndex;

            return (
              <div key={step.state} className="flex items-center">
                {idx > 0 && (
                  <div className={cn(
                    'w-6 sm:w-10 h-0.5 mx-0.5',
                    isComplete ? 'bg-green-500' : 'bg-muted',
                  )} />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    isActive && 'border-primary bg-primary text-primary-foreground animate-pulse',
                    isComplete && 'border-green-500 bg-green-500 text-white',
                    !isActive && !isComplete && 'border-muted bg-background text-muted-foreground',
                  )}>
                    {isComplete ? '✓' : idx + 1}
                  </div>
                  <span className={cn(
                    'text-[10px] sm:text-xs whitespace-nowrap',
                    isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}>
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Facilitator Info */}
          <div className="flex items-center gap-3">
            {facilitator ? (
              <>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getInitials(facilitator)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs text-muted-foreground">Facilitator</p>
                  <p className="font-medium text-sm">
                    {facilitator.firstName} {facilitator.lastName}
                    {isFacilitator && <span className="text-muted-foreground ml-1">(You)</span>}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserCog className="h-5 w-5" />
                <span className="text-sm">No facilitator assigned</span>
              </div>
            )}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-3">
            {isMeetingStarted && (
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <Timer className="h-4 w-4 text-green-600" />
                <span className="font-mono text-green-700">{elapsedTime}</span>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          {canEdit && (
            <div className="flex items-center gap-2">
              {!hasFacilitator && (
                <Button
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  <UserCog className="h-4 w-4 mr-2" />
                  Run This Meeting
                </Button>
              )}

              {isFacilitator && !isMeetingStarted && !isMeetingEnded && (
                <>
                  <Button
                    onClick={() => startMutation.mutate()}
                    disabled={startMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Meeting
                  </Button>
                  <Button
                    onClick={() => releaseMutation.mutate()}
                    disabled={releaseMutation.isPending}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              )}

              {isFacilitator && isMeetingStarted && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Square className="h-4 w-4 mr-2" />
                      End Meeting
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>End Meeting?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the meeting as complete. Make sure all decisions have been
                        recorded before ending.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => endMutation.mutate()}
                        className="bg-destructive text-destructive-foreground"
                      >
                        End Meeting
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>

        {/* Focus Navigation Row (shown when meeting is in progress) */}
        {isMeetingStarted && onFocusItem && orderedItemIds.length > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handlePrevItem}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <div className="flex-1 text-center min-w-0">
              {focusedItemTitle ? (
                <p className="text-sm font-medium truncate">{focusedItemTitle}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No item focused</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleNextItem}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">N</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">P</kbd>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MeetingControls;
