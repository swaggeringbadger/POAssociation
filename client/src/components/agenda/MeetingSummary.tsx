/**
 * MeetingSummary Component
 *
 * Shown at the top of presentation page when the meeting has ended.
 * Displays duration, attendance summary, decisions summary, and
 * a button to generate meeting minutes PDF.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Loader2,
  BarChart3,
} from 'lucide-react';
import type {
  CalendarEvent,
  User,
  MeetingAttendance,
  EventAgendaItemWithDetails,
  MeetingSectionCompletion,
  AgendaSection,
} from '@/lib/api';
import { MinutesPdfDocument } from './MinutesPdfDocument';
import { pdf } from '@react-pdf/renderer';

interface MeetingSummaryProps {
  event: CalendarEvent & {
    facilitatorUserId?: string;
    meetingStartedAt?: string;
    meetingEndedAt?: string;
  };
  facilitator?: User;
  attendance: MeetingAttendance[];
  items: EventAgendaItemWithDetails[];
  completions: MeetingSectionCompletion[];
  sections: AgendaSection[];
}

export function MeetingSummary({
  event,
  facilitator,
  attendance,
  items,
  completions,
  sections,
}: MeetingSummaryProps) {
  const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false);

  // Duration calculation
  const duration = useMemo(() => {
    if (!event.meetingStartedAt || !event.meetingEndedAt) return null;
    const start = new Date(event.meetingStartedAt);
    const end = new Date(event.meetingEndedAt);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, start, end };
  }, [event.meetingStartedAt, event.meetingEndedAt]);

  // Attendance summary
  const attendanceSummary = useMemo(() => {
    const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const excused = attendance.filter(a => a.status === 'excused').length;
    const total = attendance.length;

    const boardMembers = attendance.filter(a => a.attendeeRole === 'board_member');
    const boardPresent = boardMembers.filter(a => a.status === 'present' || a.status === 'late').length;
    const hasQuorum = boardMembers.length > 0 && boardPresent > boardMembers.length / 2;

    return { present, absent, excused, total, boardPresent, boardTotal: boardMembers.length, hasQuorum };
  }, [attendance]);

  // Decisions summary
  const decisionsSummary = useMemo(() => {
    const decided = items.filter(i => i.decision);
    const grouped: Record<string, typeof decided> = {};

    for (const item of decided) {
      const key = item.decision!;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    return { total: decided.length, grouped };
  }, [items]);

  const decisionLabels: Record<string, { label: string; style: string }> = {
    approved: { label: 'Approved', style: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rejected', style: 'bg-red-100 text-red-800' },
    tabled: { label: 'Tabled', style: 'bg-amber-100 text-amber-800' },
    needs_info: { label: 'Needs Info', style: 'bg-orange-100 text-orange-800' },
    conditional: { label: 'Conditional', style: 'bg-blue-100 text-blue-800' },
    deferred: { label: 'Deferred', style: 'bg-gray-100 text-gray-800' },
    withdrawn: { label: 'Withdrawn', style: 'bg-gray-100 text-gray-600' },
    recommended: { label: 'Recommended', style: 'bg-purple-100 text-purple-800' },
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Generate meeting minutes PDF
  const handleGenerateMinutes = async () => {
    setIsGeneratingMinutes(true);

    try {
      const pdfDoc = (
        <MinutesPdfDocument
          event={event}
          facilitator={facilitator}
          attendance={attendance}
          sections={sections}
          items={items}
          completions={completions}
        />
      );

      const blob = await pdf(pdfDoc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const eventTitle = event.title || 'Meeting';
      link.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_')}_Minutes_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate minutes PDF:', err);
    } finally {
      setIsGeneratingMinutes(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-primary/5 print:hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Meeting Summary
          </CardTitle>
          <Button
            onClick={handleGenerateMinutes}
            disabled={isGeneratingMinutes}
            size="sm"
          >
            {isGeneratingMinutes ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generate Minutes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Duration Card */}
          {duration && (
            <div className="bg-card rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                Duration
              </div>
              <p className="text-2xl font-bold">
                {duration.hours > 0 ? `${duration.hours}h ` : ''}{duration.minutes}m
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTime(duration.start)} — {formatTime(duration.end)}
              </p>
            </div>
          )}

          {/* Attendance Card */}
          <div className="bg-card rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" />
              Attendance
            </div>
            <p className="text-2xl font-bold">
              {attendanceSummary.present}/{attendanceSummary.total}
            </p>
            <div className="flex items-center gap-2">
              {attendanceSummary.hasQuorum ? (
                <Badge className="bg-green-100 text-green-800 text-xs">Quorum Met</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 text-xs">No Quorum</Badge>
              )}
              {attendanceSummary.boardTotal > 0 && (
                <span className="text-xs text-muted-foreground">
                  Board: {attendanceSummary.boardPresent}/{attendanceSummary.boardTotal}
                </span>
              )}
            </div>
          </div>

          {/* Decisions Card */}
          <div className="bg-card rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Decisions
            </div>
            <p className="text-2xl font-bold">{decisionsSummary.total}</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(decisionsSummary.grouped).map(([decision, items]) => {
                const info = decisionLabels[decision];
                return (
                  <Badge key={decision} className={`text-xs ${info?.style || 'bg-gray-100'}`}>
                    {items.length} {info?.label || decision}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        {/* Decisions detail list */}
        {decisionsSummary.total > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Decision Details</h4>
            <div className="space-y-2">
              {Object.entries(decisionsSummary.grouped).map(([decision, decItems]) => {
                const info = decisionLabels[decision];
                return (
                  <div key={decision}>
                    <div className="flex items-center gap-2 mb-1">
                      {decision === 'approved' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      ) : decision === 'rejected' ? (
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{info?.label || decision}</span>
                      <Badge variant="outline" className="text-xs">{decItems.length}</Badge>
                    </div>
                    <div className="ml-5 space-y-1">
                      {decItems.map(item => (
                        <p key={item.id} className="text-sm text-muted-foreground">
                          {item.title || item.application?.title || item.application?.applicationNumber || 'Untitled'}
                          {item.decisionNotes && (
                            <span className="italic"> — {item.decisionNotes}</span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MeetingSummary;
