import {
  getOccurrencesInRange,
  parseExceptionDates,
  formatDateKey,
  isExceptionDate,
  calculateDuration,
  addDuration,
} from '../shared/recurrence';
import type { Event, EventType } from '@shared/schema';

// Extended event type that includes recurrence instance metadata
export interface ExpandedEvent extends Omit<Event, 'startDatetime' | 'endDatetime'> {
  eventType: EventType | null;
  startDatetime: string;
  endDatetime: string;
  // Recurrence instance metadata
  isRecurrenceInstance?: boolean;
  originalDate?: string; // YYYY-MM-DD of this occurrence
  seriesId?: string; // ID of the parent recurring event
}

// Input event type from database query
export interface EventWithType extends Event {
  eventType: EventType | null;
}

/**
 * Expand recurring events within a date range
 *
 * @param events - Array of events from database (including recurring base events)
 * @param exceptionEvents - Array of exception events (events with parentEventId set)
 * @param rangeStart - Start of date range to expand
 * @param rangeEnd - End of date range to expand
 * @returns Array of expanded events (non-recurring + recurring instances)
 */
export function expandRecurringEvents(
  events: EventWithType[],
  exceptionEvents: EventWithType[],
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent[] {
  const result: ExpandedEvent[] = [];

  // Build a map of exception events by parent ID and original date
  const exceptionMap = new Map<string, Map<string, EventWithType>>();
  for (const exception of exceptionEvents) {
    if (!exception.parentEventId || !exception.originalOccurrenceDate) continue;

    if (!exceptionMap.has(exception.parentEventId)) {
      exceptionMap.set(exception.parentEventId, new Map());
    }
    exceptionMap.get(exception.parentEventId)!.set(exception.originalOccurrenceDate, exception);
  }

  for (const event of events) {
    // Skip exception events in the main event list (they're handled separately)
    if (event.parentEventId) {
      continue;
    }

    if (!event.recurrenceRule) {
      // Non-recurring event: include if in range
      const eventStart = new Date(event.startDatetime);
      if (eventStart >= rangeStart && eventStart <= rangeEnd) {
        result.push({
          ...event,
          startDatetime: event.startDatetime instanceof Date
            ? event.startDatetime.toISOString()
            : event.startDatetime,
          endDatetime: event.endDatetime instanceof Date
            ? event.endDatetime.toISOString()
            : event.endDatetime,
        });
      }
      continue;
    }

    // Recurring event: expand instances
    const eventStartDate = new Date(event.startDatetime);
    const eventEndDate = new Date(event.endDatetime);
    const duration = calculateDuration(eventStartDate, eventEndDate);

    // Get all occurrences in the range
    const occurrences = getOccurrencesInRange(
      event.recurrenceRule,
      eventStartDate,
      rangeStart,
      rangeEnd
    );

    // Parse exception dates (deleted occurrences)
    const exDates = parseExceptionDates(event.exceptionDates);

    // Get exception events for this series
    const seriesExceptions = exceptionMap.get(event.id) || new Map();

    for (const occurrence of occurrences) {
      const occurrenceDateKey = formatDateKey(occurrence);

      // Skip deleted occurrences
      if (isExceptionDate(occurrence, exDates)) {
        continue;
      }

      // Check if there's an exception event for this date
      const exceptionEvent = seriesExceptions.get(occurrenceDateKey);
      if (exceptionEvent) {
        // Use the exception event instead of the generated instance
        result.push({
          ...exceptionEvent,
          startDatetime: exceptionEvent.startDatetime instanceof Date
            ? exceptionEvent.startDatetime.toISOString()
            : exceptionEvent.startDatetime,
          endDatetime: exceptionEvent.endDatetime instanceof Date
            ? exceptionEvent.endDatetime.toISOString()
            : exceptionEvent.endDatetime,
          isRecurrenceInstance: true,
          originalDate: occurrenceDateKey,
          seriesId: event.id,
        });
        continue;
      }

      // Generate virtual instance
      const instanceEnd = addDuration(occurrence, duration);

      // Preserve the time from the original event
      const instanceStart = new Date(occurrence);
      instanceStart.setHours(eventStartDate.getHours());
      instanceStart.setMinutes(eventStartDate.getMinutes());
      instanceStart.setSeconds(eventStartDate.getSeconds());

      const adjustedInstanceEnd = addDuration(instanceStart, duration);

      result.push({
        ...event,
        // Virtual ID: parentId_YYYY-MM-DD
        id: `${event.id}_${occurrenceDateKey}`,
        startDatetime: instanceStart.toISOString(),
        endDatetime: adjustedInstanceEnd.toISOString(),
        isRecurrenceInstance: true,
        originalDate: occurrenceDateKey,
        seriesId: event.id,
      });
    }
  }

  // Sort by start datetime
  result.sort((a, b) => {
    return new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime();
  });

  return result;
}

/**
 * Get the real event ID from a potentially virtual ID
 * Virtual IDs have format: realId_YYYY-MM-DD
 */
export function getRealEventId(eventId: string): string {
  const parts = eventId.split('_');
  // If it's a virtual ID (UUID_date), return just the UUID part
  if (parts.length === 2 && parts[1].match(/^\d{4}-\d{2}-\d{2}$/)) {
    return parts[0];
  }
  return eventId;
}

/**
 * Check if an event ID is a virtual (recurrence instance) ID
 */
export function isVirtualEventId(eventId: string): boolean {
  const parts = eventId.split('_');
  return parts.length === 2 && parts[1].match(/^\d{4}-\d{2}-\d{2}$/) !== null;
}

/**
 * Extract the original date from a virtual event ID
 */
export function getOriginalDateFromVirtualId(eventId: string): string | null {
  const parts = eventId.split('_');
  if (parts.length === 2 && parts[1].match(/^\d{4}-\d{2}-\d{2}$/)) {
    return parts[1];
  }
  return null;
}
