/**
 * MeetingControls Component
 *
 * Controls for the meeting facilitator to claim/release role,
 * start/end meeting, and view meeting status.
 */

import { useState, useEffect } from 'react';
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
import { Play, Square, UserCog, Timer, LogOut } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { claimFacilitator, releaseFacilitator, startMeeting, endMeeting } from '@/lib/api';
import type { CalendarEvent, User } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface MeetingControlsProps {
  event: CalendarEvent & {
    facilitatorUserId?: string;
    facilitatorClaimedAt?: string;
    meetingStartedAt?: string;
    meetingEndedAt?: string;
  };
  facilitator?: User;
  canEdit?: boolean;
  className?: string;
}

export function MeetingControls({
  event,
  facilitator,
  canEdit = false,
  className = '',
}: MeetingControlsProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

  const isFacilitator = user?.id === event.facilitatorUserId;
  const hasFacilitator = !!event.facilitatorUserId;
  const isMeetingStarted = !!event.meetingStartedAt && !event.meetingEndedAt;
  const isMeetingEnded = !!event.meetingEndedAt;

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

  return (
    <Card className={`print:hidden meeting-controls-card ${className}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Facilitator Info */}
          <div className="flex items-center gap-3">
            {facilitator ? (
              <>
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(facilitator)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground">Facilitator</p>
                  <p className="font-medium">
                    {facilitator.firstName} {facilitator.lastName}
                    {isFacilitator && <span className="text-muted-foreground ml-1">(You)</span>}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserCog className="h-5 w-5" />
                <span>No facilitator assigned</span>
              </div>
            )}
          </div>

          {/* Meeting Status */}
          <div className="flex items-center gap-3">
            {isMeetingStarted && (
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <Timer className="h-4 w-4 text-green-600" />
                <span className="font-mono text-green-700">{elapsedTime}</span>
              </div>
            )}
            {isMeetingEnded && (
              <Badge className="bg-muted text-muted-foreground">
                Meeting Ended
              </Badge>
            )}
            {!isMeetingStarted && !isMeetingEnded && (
              <Badge variant="outline">Not Started</Badge>
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
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Meeting
                  </Button>
                  <Button
                    onClick={() => releaseMutation.mutate()}
                    disabled={releaseMutation.isPending}
                    variant="ghost"
                    size="sm"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              )}

              {isFacilitator && isMeetingStarted && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
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
      </CardContent>
    </Card>
  );
}

export default MeetingControls;
