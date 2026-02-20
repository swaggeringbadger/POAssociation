/**
 * AgendaPresentation Page
 *
 * Presentation mode for meeting agendas - a "flattened" view where
 * everything is visible inline (no clicking/hovering required).
 * Used for running live meetings.
 *
 * Route: /calendar/events/:eventId/agenda/present
 */

import { useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Printer,
  Edit,
  Download,
  Loader2,
} from 'lucide-react';
import { getEventPresentationData } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import {
  MeetingControls,
  RollCallAttendance,
  PresentationAgendaSection,
} from '@/components/agenda';
import { AgendaPdfDocument } from '@/components/agenda/AgendaPdfDocument';
import { pdf } from '@react-pdf/renderer';

export default function AgendaPresentation() {
  const { eventId } = useParams<{ eventId: string }>();
  const { currentUserRole } = useAppStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Fetch presentation data
  const { data, isLoading, error } = useQuery({
    queryKey: ['presentation-data', eventId],
    queryFn: () => getEventPresentationData(eventId!),
    enabled: !!eventId,
    refetchInterval: 10000, // Refresh every 10 seconds for live updates
  });

  // Determine if user can edit (facilitator controls, mark attendance, etc.)
  const canEdit = useMemo(() => {
    const editRoles = [
      'poa_board_member',
      'management_manager',
      'account_admin',
      'super_admin',
    ];
    return editRoles.includes(currentUserRole || '');
  }, [currentUserRole]);

  // Group items by section
  const itemsBySection = useMemo(() => {
    if (!data?.agenda.items) return new Map();

    const map = new Map<string, typeof data.agenda.items>();
    for (const item of data.agenda.items) {
      const sectionItems = map.get(item.sectionId) || [];
      sectionItems.push(item);
      map.set(item.sectionId, sectionItems);
    }
    return map;
  }, [data?.agenda.items]);

  // Create completion lookup
  const completionsBySection = useMemo(() => {
    if (!data?.agenda.completions) return new Map();

    const map = new Map<string, typeof data.agenda.completions[0]>();
    for (const completion of data.agenda.completions) {
      map.set(completion.sectionId, completion);
    }
    return map;
  }, [data?.agenda.completions]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle PDF download using @react-pdf/renderer
  const handleDownloadPdf = async () => {
    if (!data) {
      console.error('Cannot generate PDF: missing data');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      // Create the PDF document
      const pdfDoc = (
        <AgendaPdfDocument
          event={data.event}
          facilitator={data.facilitator}
          attendance={data.attendance}
          sections={data.agenda.sections}
          items={data.agenda.items}
          completions={data.agenda.completions}
        />
      );

      // Generate blob
      const blob = await pdf(pdfDoc).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const eventTitle = data.event.title || 'Meeting_Agenda';
      link.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_')}_Agenda_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      // Fall back to native print dialog
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : 'Failed to load meeting data'}
        </p>
        <Link href={`/calendar/events/${eventId}/agenda`}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agenda
          </Button>
        </Link>
      </div>
    );
  }

  const { event, agenda, attendance, facilitator } = data;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Navigation - hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/calendar/events/${eventId}/agenda`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Edit Mode
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/calendar/events/${eventId}/agenda`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit Agenda
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Printable Content Wrapper */}
      <div ref={printRef} className="print-content">
        {/* Meeting Header */}
        <div className="space-y-4 pdf-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:flex-col print:items-start">
            <div>
              <h1 className="text-2xl font-bold print:text-xl">{event.title}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground mt-1 print:text-sm">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4 print:h-3 print:w-3" />
                  {formatDate(event.startDatetime)} at {formatTime(event.startDatetime)}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 print:h-3 print:w-3" />
                    {event.location}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 print:mt-2">
              {event.agendaFinalized && (
                <Badge className="bg-green-100 text-green-800 print:text-xs">Agenda Finalized</Badge>
              )}
              {event.meetingStartedAt && !event.meetingEndedAt && (
                <Badge className="bg-green-600 text-white print:text-xs">Meeting In Progress</Badge>
              )}
              {event.meetingEndedAt && (
                <Badge variant="outline" className="print:text-xs">Meeting Completed</Badge>
              )}
            </div>
          </div>

          {event.description && (
            <p className="text-muted-foreground print:text-sm">{event.description}</p>
          )}

          {/* Facilitator info for print */}
          {facilitator && (
            <p className="text-sm text-muted-foreground hidden print:block">
              <strong>Facilitator:</strong> {facilitator.firstName} {facilitator.lastName}
            </p>
          )}
        </div>

        {/* Meeting Controls - hidden in print */}
        <MeetingControls
          event={event}
          facilitator={facilitator}
          canEdit={canEdit}
        />

        <Separator className="print:my-3" />

        {/* Roll Call / Attendance */}
        <div className="pdf-section">
          <RollCallAttendance
            eventId={eventId!}
            attendance={attendance}
            canEdit={canEdit}
          />
        </div>

        <Separator className="print:my-3" />

        {/* Agenda Sections */}
        <div className="space-y-6 print:space-y-4 pdf-section">
          <h2 className="text-xl font-semibold print:text-lg">Meeting Agenda</h2>

          {agenda.sections
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((section) => {
              const items = itemsBySection.get(section.id) || [];
              const completion = completionsBySection.get(section.id);

              return (
                <PresentationAgendaSection
                  key={section.id}
                  section={section}
                  items={items}
                  completion={completion}
                  eventId={eventId!}
                  canEdit={canEdit}
                />
              );
            })}
        </div>

        {/* Print/PDF Footer */}
        <div className="hidden print:block pt-6 mt-6 border-t text-xs text-muted-foreground pdf-footer">
          <div className="flex justify-between">
            <span>POA Association Portal</span>
            <span>Generated: {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}</span>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.5in;
            size: letter portrait;
          }

          body {
            font-size: 11px !important;
            line-height: 1.4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          .print\\:block {
            display: block !important;
          }

          .pdf-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .pdf-header {
            break-after: avoid;
            page-break-after: avoid;
          }

          button,
          [role="button"],
          input[type="checkbox"] {
            display: none !important;
          }

          .meeting-controls-card {
            display: none !important;
          }

          .pdf-footer {
            display: flex !important;
          }

          .bg-green-100, .bg-green-600, .bg-red-100,
          .bg-amber-100, .bg-blue-100, .bg-muted {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        .print-content {
          background: white;
        }

        .print-content .pdf-footer {
          display: none;
        }
      `}</style>
    </div>
  );
}
