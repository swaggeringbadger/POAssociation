/**
 * RollCallAttendance Component
 *
 * Before agenda finalization: dynamically shows directory members (board, management,
 * delegated reps) plus any manually added people. Attendance statuses are persisted.
 * After finalization: the snapshot is locked in, but people can still be added/removed.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Users, UserCheck, UserX, Clock, CheckCircle2, UserPlus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { markAttendance, initializeMeetingAttendance, addAttendee, removeAttendee, getAttendanceDirectory } from '@/lib/api';
import type { MeetingAttendance, AttendanceStatus, User } from '@/lib/api';
import { toast } from 'sonner';

/** Roles that are auto-populated in roll call */
const AUTO_POPULATE_ROLES = [
  'poa_board_member',
  'poa_board_contributor',
  'delegated_rep',
  'management_rep',
  'management_manager',
];

interface RollCallAttendanceProps {
  eventId: string;
  tenantId: string;
  attendance: MeetingAttendance[];
  isFinalized?: boolean;
  canEdit?: boolean;
  className?: string;
}

export function RollCallAttendance({
  eventId,
  tenantId,
  attendance,
  isFinalized = false,
  canEdit = false,
  className = '',
}: RollCallAttendanceProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [addPersonOpen, setAddPersonOpen] = useState(false);

  // Fetch directory members (community + management company) for roll call
  const { data: directoryMembers } = useQuery({
    queryKey: ['attendanceDirectory', eventId],
    queryFn: () => getAttendanceDirectory(eventId),
    enabled: !!eventId,
  });

  // Build the effective attendance list:
  // Before finalization: merge directory auto-members with any persisted attendance records
  // After finalization: just use persisted attendance records
  const effectiveAttendance = useMemo(() => {
    if (isFinalized || !directoryMembers) {
      return attendance;
    }

    // Get directory members that should be auto-populated
    const autoMembers = directoryMembers.filter(m =>
      m.roles.some((r: string) => AUTO_POPULATE_ROLES.includes(r))
    );

    // Index existing attendance by userId
    const attendanceByUserId = new Map(attendance.map(a => [a.userId, a]));

    // Start with auto-populated members (merged with any existing status)
    const merged: MeetingAttendance[] = autoMembers.map(member => {
      const existing = attendanceByUserId.get(member.id);
      if (existing) return existing;

      // Synthesize a virtual attendance record (not yet persisted)
      return {
        id: `virtual-${member.id}`,
        eventId,
        userId: member.id,
        status: 'expected' as AttendanceStatus,
        attendeeRole: getAttendeeRoleFromUserRoles(member.roles),
        markedAt: null,
        markedByUserId: null,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: member as any,
      };
    });

    // Add any manually-added attendance records that aren't in the auto list
    const autoUserIds = new Set(autoMembers.map(m => m.id));
    for (const record of attendance) {
      if (!autoUserIds.has(record.userId)) {
        merged.push(record);
      }
    }

    return merged;
  }, [attendance, directoryMembers, isFinalized, eventId]);

  // Users already shown in the attendance list
  const attendeeUserIds = useMemo(
    () => new Set(effectiveAttendance.map(a => a.userId)),
    [effectiveAttendance]
  );

  // Available members for the "Add Person" picker (not already on the list)
  const availableMembers = useMemo(
    () => (directoryMembers || []).filter(m => !attendeeUserIds.has(m.id)),
    [directoryMembers, attendeeUserIds]
  );

  // Group attendance by role
  const boardMembers = effectiveAttendance.filter(a => a.attendeeRole === 'board_member');
  const management = effectiveAttendance.filter(a => a.attendeeRole === 'management');
  const homeowners = effectiveAttendance.filter(a => a.attendeeRole === 'homeowner');
  const guests = effectiveAttendance.filter(a => a.attendeeRole === 'guest');
  const others = effectiveAttendance.filter(a => !a.attendeeRole || !['board_member', 'management', 'homeowner', 'guest'].includes(a.attendeeRole));

  // Calculate attendance stats
  const presentCount = effectiveAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const totalCount = effectiveAttendance.length;

  // Auto-initialize persisted records when agenda is finalized and attendance is empty
  const hasAutoInitialized = useRef(false);
  const initializeMutation = useMutation({
    mutationFn: () => initializeMeetingAttendance(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to initialize attendance: ${error.message}`);
    },
  });

  useEffect(() => {
    // When finalized and no persisted records yet, snapshot the directory
    if (isFinalized && attendance.length === 0 && canEdit && !hasAutoInitialized.current && !initializeMutation.isPending) {
      hasAutoInitialized.current = true;
      initializeMutation.mutate();
    }
  }, [isFinalized, attendance.length, canEdit]);

  // Mark attendance mutation — for virtual records, this will also create the DB row
  const markMutation = useMutation({
    mutationFn: ({ userId, status, attendeeRole, notes }: { userId: string; status: AttendanceStatus; attendeeRole?: string; notes?: string }) => {
      // Check if this is a virtual record (not yet in DB)
      const existingRecord = attendance.find(a => a.userId === userId);
      if (!existingRecord) {
        // Create the record first via addAttendee, then it'll be in the DB
        return addAttendee(eventId, { userId, attendeeRole, status, notes });
      }
      return markAttendance(eventId, userId, status, notes);
    },
    onMutate: async ({ userId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', eventId] });
      const previousData = queryClient.getQueryData(['presentation-data', eventId]);
      queryClient.setQueryData(['presentation-data', eventId], (old: any) => {
        if (!old) return old;
        const exists = old.attendance.some((a: MeetingAttendance) => a.userId === userId);
        if (exists) {
          return {
            ...old,
            attendance: old.attendance.map((a: MeetingAttendance) =>
              a.userId === userId ? { ...a, status } : a
            ),
          };
        }
        return old;
      });
      return { previousData };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', eventId], context.previousData);
      }
      toast.error(`Failed to update attendance: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
    },
  });

  // Add attendee mutation
  const addMutation = useMutation({
    mutationFn: (member: User & { roles: string[] }) => {
      const attendeeRole = getAttendeeRoleFromUserRoles(member.roles);
      return addAttendee(eventId, { userId: member.id, attendeeRole, status: 'expected' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
      setAddPersonOpen(false);
      toast.success('Attendee added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add attendee: ${error.message}`);
    },
  });

  // Remove attendee mutation
  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeAttendee(eventId, userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', eventId] });
      const previousData = queryClient.getQueryData(['presentation-data', eventId]);
      queryClient.setQueryData(['presentation-data', eventId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          attendance: old.attendance.filter((a: MeetingAttendance) => a.userId !== userId),
        };
      });
      return { previousData };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', eventId], context.previousData);
      }
      toast.error(`Failed to remove attendee: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
    },
  });

  const handleStatusChange = (userId: string, currentStatus: AttendanceStatus, attendeeRole?: string | null) => {
    if (!canEdit) return;
    const statusCycle: AttendanceStatus[] = ['expected', 'present', 'absent', 'late', 'excused'];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    markMutation.mutate({ userId, status: nextStatus, attendeeRole: attendeeRole || undefined, notes: notes[userId] });
  };

  const markAllPresent = () => {
    if (!canEdit) return;
    effectiveAttendance
      .filter(a => a.status === 'expected')
      .forEach(a => {
        markMutation.mutate({ userId: a.userId, status: 'present', attendeeRole: a.attendeeRole || undefined });
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

  const isVirtualRecord = (record: MeetingAttendance) => record.id.startsWith('virtual-');

  const renderAttendeeRow = (record: MeetingAttendance) => (
    <div
      key={record.id}
      className={`flex items-center justify-between min-h-12 py-2 px-3 rounded-md group ${
        canEdit ? 'hover:bg-muted cursor-pointer' : ''
      }`}
      onClick={() => canEdit && handleStatusChange(record.userId, record.status, record.attendeeRole)}
    >
      <div className="flex items-center gap-3">
        {canEdit ? (
          <Checkbox
            checked={record.status === 'present' || record.status === 'late'}
            onCheckedChange={() => handleStatusChange(record.userId, record.status, record.attendeeRole)}
            className="h-5 w-5"
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
      <div className="flex items-center gap-2">
        {getStatusBadge(record.status)}
        {canEdit && !isVirtualRecord(record) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
            onClick={(e) => {
              e.stopPropagation();
              removeMutation.mutate(record.userId);
            }}
            title="Remove from roll call"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
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

  if (effectiveAttendance.length === 0) {
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
            No directory members found for this community.
          </p>
          {canEdit && (
            <Popover open={addPersonOpen} onOpenChange={setAddPersonOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Person
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-72" align="start">
                <Command>
                  <CommandInput placeholder="Search directory..." />
                  <CommandList>
                    <CommandEmpty>No members found.</CommandEmpty>
                    {availableMembers.length > 0 && (
                      <CommandGroup heading="Directory Members">
                        {availableMembers.map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => addMutation.mutate(member)}
                            className="cursor-pointer"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {member.firstName} {member.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {formatRoles(member.roles)}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

            <Popover open={addPersonOpen} onOpenChange={setAddPersonOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Person
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-72" align="start">
                <Command>
                  <CommandInput placeholder="Search directory..." />
                  <CommandList>
                    <CommandEmpty>No members found.</CommandEmpty>
                    {availableMembers.length > 0 && (
                      <CommandGroup heading="Directory Members">
                        {availableMembers.map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => addMutation.mutate(member)}
                            className="cursor-pointer"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {member.firstName} {member.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {formatRoles(member.roles)}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="space-y-4">
          {renderGroup('Board Members', boardMembers)}
          {renderGroup('Management', management)}
          {renderGroup('Homeowners', homeowners)}
          {renderGroup('Guests / Contractors', guests)}
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

/** Map user directory roles to meeting attendee role */
function getAttendeeRoleFromUserRoles(roles: string[]): string {
  if (roles.some(r => r.startsWith('poa_') || r === 'delegated_rep')) return 'board_member';
  if (roles.some(r => r.startsWith('management_') || r === 'account_admin' || r === 'super_admin')) return 'management';
  if (roles.some(r => r === 'homeowner' || r === 'household_member')) return 'homeowner';
  if (roles.some(r => r === 'contractor')) return 'guest';
  return 'guest';
}

/** Format role names for display */
function formatRoles(roles: string[]): string {
  const roleLabels: Record<string, string> = {
    poa_board_member: 'Board Member',
    poa_board_contributor: 'Board Contributor',
    delegated_rep: 'Delegated Rep',
    management_manager: 'Manager',
    management_rep: 'Management Rep',
    management_auxiliary: 'Management Aux',
    account_admin: 'Account Admin',
    super_admin: 'Super Admin',
    homeowner: 'Homeowner',
    household_member: 'Household Member',
    contractor: 'Contractor',
  };
  return roles.map(r => roleLabels[r] || r).join(', ');
}

export default RollCallAttendance;
