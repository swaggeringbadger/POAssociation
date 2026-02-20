/**
 * RollCallAttendance Component
 *
 * Checkbox list of expected attendees for roll call during meetings.
 * Groups attendees by role (Board Members, Management).
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, UserCheck, UserX, Clock, CheckCircle2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markAttendance, initializeMeetingAttendance } from '@/lib/api';
import type { MeetingAttendance, AttendanceStatus } from '@/lib/api';
import { toast } from 'sonner';

interface RollCallAttendanceProps {
  eventId: string;
  attendance: MeetingAttendance[];
  canEdit?: boolean;
  className?: string;
}

export function RollCallAttendance({
  eventId,
  attendance,
  canEdit = false,
  className = '',
}: RollCallAttendanceProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Group attendance by role
  const boardMembers = attendance.filter(a => a.attendeeRole === 'board_member');
  const management = attendance.filter(a => a.attendeeRole === 'management');
  const others = attendance.filter(a => !a.attendeeRole || !['board_member', 'management'].includes(a.attendeeRole));

  // Calculate attendance stats
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const totalCount = attendance.length;

  // Initialize attendance mutation
  const initializeMutation = useMutation({
    mutationFn: () => initializeMeetingAttendance(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
      toast.success('Attendance list initialized');
    },
    onError: (error: Error) => {
      toast.error(`Failed to initialize attendance: ${error.message}`);
    },
  });

  // Mark attendance mutation with optimistic updates
  const markMutation = useMutation({
    mutationFn: ({ userId, status, notes }: { userId: string; status: AttendanceStatus; notes?: string }) =>
      markAttendance(eventId, userId, status, notes),
    onMutate: async ({ userId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['presentation-data', eventId] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['presentation-data', eventId]);

      // Optimistically update the cache
      queryClient.setQueryData(['presentation-data', eventId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          attendance: old.attendance.map((a: MeetingAttendance) =>
            a.userId === userId ? { ...a, status } : a
          ),
        };
      });

      return { previousData };
    },
    onError: (error: Error, _variables, context) => {
      // Roll back on error
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', eventId], context.previousData);
      }
      toast.error(`Failed to update attendance: ${error.message}`);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
    },
  });

  const handleStatusChange = (userId: string, currentStatus: AttendanceStatus) => {
    if (!canEdit) return;

    // Cycle through statuses: expected -> present -> absent -> late -> excused -> expected
    const statusCycle: AttendanceStatus[] = ['expected', 'present', 'absent', 'late', 'excused'];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

    markMutation.mutate({
      userId,
      status: nextStatus,
      notes: notes[userId],
    });
  };

  const markAllPresent = () => {
    if (!canEdit) return;

    attendance
      .filter(a => a.status === 'expected')
      .forEach(a => {
        markMutation.mutate({ userId: a.userId, status: 'present' });
      });
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <UserCheck className="h-4 w-4 text-green-600" />;
      case 'absent':
        return <UserX className="h-4 w-4 text-red-600" />;
      case 'late':
        return <Clock className="h-4 w-4 text-amber-600" />;
      case 'excused':
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Present</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Absent</Badge>;
      case 'late':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Late</Badge>;
      case 'excused':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Excused</Badge>;
      default:
        return <Badge variant="outline">Expected</Badge>;
    }
  };

  const renderAttendeeRow = (record: MeetingAttendance) => (
    <div
      key={record.id}
      className={`flex items-center justify-between py-2 px-3 rounded-md ${
        canEdit ? 'hover:bg-muted cursor-pointer' : ''
      }`}
      onClick={() => canEdit && handleStatusChange(record.userId, record.status)}
    >
      <div className="flex items-center gap-3">
        {canEdit ? (
          <Checkbox
            checked={record.status === 'present' || record.status === 'late'}
            onCheckedChange={() => handleStatusChange(record.userId, record.status)}
          />
        ) : (
          getStatusIcon(record.status)
        )}
        <div>
          <span className="font-medium">
            {record.user?.firstName} {record.user?.lastName}
          </span>
          {record.notes && (
            <p className="text-xs text-muted-foreground">{record.notes}</p>
          )}
        </div>
      </div>
      {getStatusBadge(record.status)}
    </div>
  );

  const renderGroup = (title: string, records: MeetingAttendance[]) => {
    if (records.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <div className="space-y-1">
          {records.map(renderAttendeeRow)}
        </div>
      </div>
    );
  };

  if (attendance.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Roll Call / Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No attendance records yet.
          </p>
          {canEdit && (
            <Button
              onClick={() => initializeMutation.mutate()}
              disabled={initializeMutation.isPending}
              className="w-full"
            >
              Initialize Attendance List
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Roll Call / Attendance
          </CardTitle>
          <Badge variant="outline" className="text-base">
            {presentCount}/{totalCount} Present
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="flex gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllPresent}
              disabled={markMutation.isPending}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Mark All Present
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {renderGroup('Board Members', boardMembers)}
          {renderGroup('Management', management)}
          {renderGroup('Other Attendees', others)}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-3 border-t text-xs text-muted-foreground print:hidden">
          <span className="flex items-center gap-1">
            <UserCheck className="h-3 w-3 text-green-600" /> Present
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-600" /> Late
          </span>
          <span className="flex items-center gap-1">
            <UserX className="h-3 w-3 text-red-600" /> Absent
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-blue-600" /> Excused
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default RollCallAttendance;
