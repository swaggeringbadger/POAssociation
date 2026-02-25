/**
 * AgendaPresentation Page
 *
 * Presentation mode for meeting agendas - a sidebar-guided, focus-enabled
 * live-meeting experience with keyboard navigation and post-meeting summary.
 *
 * Route: /calendar/events/:eventId/agenda/present
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Printer,
  Edit,
  Download,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { getEventPresentationData } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import {
  MeetingControls,
  RollCallAttendance,
  PresentationAgendaSection,
  SectionNavigator,
} from '@/components/agenda';
import { MeetingSummary } from '@/components/agenda/MeetingSummary';
import { AgendaPdfDocument } from '@/components/agenda/AgendaPdfDocument';
import { pdf } from '@react-pdf/renderer';

export default function AgendaPresentation() {
  const { eventId } = useParams<{ eventId: string }>();
  const { currentUserRole, setCurrentPageTitle } = useAppStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);

  // Fetch presentation data
  const { data, isLoading, error } = useQuery({
    queryKey: ['presentation-data', eventId],
    queryFn: () => getEventPresentationData(eventId!),
    enabled: !!eventId,
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  // Set page title from event name
  useEffect(() => {
    if (data?.event) {
      setCurrentPageTitle(`${data.event.title} — Presentation`);
    }
    return () => setCurrentPageTitle(null);
  }, [data?.event?.title, setCurrentPageTitle]);

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

  // Sorted sections
  const sortedSections = useMemo(() => {
    if (!data?.agenda.sections) return [];
    return [...data.agenda.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data?.agenda.sections]);

  // Build ordered item IDs for keyboard navigation
  const orderedItemIds = useMemo(() => {
    const ids: string[] = [];
    for (const section of sortedSections) {
      const items = itemsBySection.get(section.id) || [];
      for (const item of items) {
        ids.push(item.id);
      }
    }
    return ids;
  }, [sortedSections, itemsBySection]);

  // Handle section click -> scroll into view
  const handleSectionClick = useCallback((sectionId: string) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Focus an item and scroll to it
  const handleFocusItem = useCallback((itemId: string) => {
    setFocusedItemId(prev => prev === itemId ? null : itemId);
    setTimeout(() => {
      const el = document.getElementById(`item-${itemId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when typing in textarea/input
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (orderedItemIds.length === 0) return;
        const currentIdx = focusedItemId ? orderedItemIds.indexOf(focusedItemId) : -1;
        const nextIdx = currentIdx < orderedItemIds.length - 1 ? currentIdx + 1 : 0;
        handleFocusItem(orderedItemIds[nextIdx]);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (orderedItemIds.length === 0) return;
        const currentIdx = focusedItemId ? orderedItemIds.indexOf(focusedItemId) : 0;
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : orderedItemIds.length - 1;
        handleFocusItem(orderedItemIds[prevIdx]);
      } else if (e.key === 'Escape') {
        setFocusedItemId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedItemId, orderedItemIds, handleFocusItem]);

  // Show keyboard hint on first visit
  useEffect(() => {
    const key = 'agenda-keyboard-hint-shown';
    if (!sessionStorage.getItem(key)) {
      setShowKeyboardHint(true);
      sessionStorage.setItem(key, '1');
      const timer = setTimeout(() => setShowKeyboardHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // IntersectionObserver to track visible section
  useEffect(() => {
    if (!data?.agenda.sections) return;

    const sectionElements = sortedSections
      .map(s => document.getElementById(`section-${s.id}`))
      .filter(Boolean) as HTMLElement[];

    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id.replace('section-', '');
            setActiveSectionId(sectionId);
            break;
          }
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );

    sectionElements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [data?.agenda.sections, sortedSections]);

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
    if (!data) return;

    setIsGeneratingPdf(true);

    try {
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

      const blob = await pdf(pdfDoc).toBlob();
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
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-6">
        {/* Sidebar skeleton */}
        <div className="hidden lg:block w-[260px] shrink-0">
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-20" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
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
    <div className="space-y-4 print:space-y-4">
      {/* Navigation - hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/calendar/events/${eventId}/agenda`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Edit Mode
          </Button>
        </Link>

        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-2">
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

        {/* Mobile actions dropdown */}
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Link href={`/calendar/events/${eventId}/agenda`}>
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Agenda
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Post-Meeting Summary (shown when meeting ended) */}
      {event.meetingEndedAt && (
        <MeetingSummary
          event={event}
          facilitator={facilitator}
          attendance={attendance}
          items={data.agenda.items}
          completions={data.agenda.completions}
          sections={data.agenda.sections}
        />
      )}

      {/* Main layout: sidebar + content */}
      <div className="flex gap-6">
        {/* Section Navigator (desktop sidebar + mobile top bar) */}
        <SectionNavigator
          sections={sortedSections}
          itemsBySection={itemsBySection}
          completions={completionsBySection}
          activeSectionId={activeSectionId}
          onSectionClick={handleSectionClick}
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div ref={printRef} className="print-content space-y-6">
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
              attendance={attendance}
              completions={data.agenda.completions}
              focusedItemId={focusedItemId}
              orderedItemIds={orderedItemIds}
              items={data.agenda.items}
              onFocusItem={handleFocusItem}
            />

            <Separator className="print:my-3" />

            {/* Roll Call / Attendance */}
            <div className="pdf-section" id={`section-${sortedSections.find(s => s.slug === 'roll_call')?.id || 'roll-call'}`}>
              <RollCallAttendance
                eventId={eventId!}
                tenantId={event.tenantId}
                attendance={attendance}
                isFinalized={event.agendaFinalized}
                canEdit={canEdit}
              />
            </div>

            <Separator className="print:my-3" />

            {/* Agenda Sections */}
            <div className="space-y-6 print:space-y-4 pdf-section">
              <h2 className="text-xl font-semibold print:text-lg">Meeting Agenda</h2>

              {sortedSections
                .filter((section) => section.slug !== 'roll_call')
                .map((section) => {
                const items = itemsBySection.get(section.id) || [];
                const completion = completionsBySection.get(section.id);

                return (
                  <div key={section.id} id={`section-${section.id}`}>
                    <PresentationAgendaSection
                      section={section}
                      items={items}
                      completion={completion}
                      eventId={eventId!}
                      canEdit={canEdit}
                      focusedItemId={focusedItemId}
                      onFocusItem={handleFocusItem}
                    />
                  </div>
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
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      {showKeyboardHint && (
        <div className="fixed bottom-6 right-6 z-50 bg-card border shadow-lg rounded-lg px-4 py-3 print:hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-sm text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">N</kbd> / <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">P</kbd> to navigate items
          </p>
        </div>
      )}

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
          input[type="checkbox"],
          textarea {
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
