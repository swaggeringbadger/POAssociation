import {
  getOccurrencesInRange,
  parseExceptionDates,
  formatDateKey,
  isExceptionDate,
  calculateDuration,
  addDuration,
} from '../shared/recurrence';
import type { Event, EventType } from '@shared/schema';

/**
 * Convert a UTC date to local time components in a specific timezone
 */
function getLocalTimeComponents(utcDate: Date, timezone: string): { hours: number; minutes: number; seconds: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const seconds = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

  return { hours, minutes, seconds };
}

/**
 * Create a date with specific local time in a timezone, returning UTC
 * This handles DST correctly - if you want "9am in New York", it gives you the correct UTC
 * whether New York is in EST or EDT
 */
function createDateInTimezone(year: number, month: number, day: number, hours: number, minutes: number, seconds: number, timezone: string): Date {
  // Create an ISO string that represents the local time
  const localDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Use Intl.DateTimeFormat to find the UTC offset for this specific date/time in the timezone
  const testDate = new Date(localDateStr + 'Z'); // Start with assuming UTC

  // Get what hour it would be in the target timezone if this were UTC
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Binary search to find the correct UTC time
  // We want to find UTC time T such that when T is displayed in `timezone`, it shows our target local time
  let low = testDate.getTime() - 24 * 60 * 60 * 1000; // -24 hours
  let high = testDate.getTime() + 24 * 60 * 60 * 1000; // +24 hours

  for (let i = 0; i < 20; i++) { // Binary search iterations
    const mid = Math.floor((low + high) / 2);
    const midDate = new Date(mid);
    const parts = formatter.formatToParts(midDate);

    const tzHours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const tzMinutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
    const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);

    // Compare as total minutes from epoch-ish
    const targetTotal = year * 525600 + month * 43800 + day * 1440 + hours * 60 + minutes;
    const currentTotal = tzYear * 525600 + tzMonth * 43800 + tzDay * 1440 + tzHours * 60 + tzMinutes;

    if (currentTotal < targetTotal) {
      low = mid;
    } else if (currentTotal > targetTotal) {
      high = mid;
    } else {
      return midDate;
    }
  }

  return new Date(Math.floor((low + high) / 2));
}

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

      // Generate virtual instance with timezone-aware time handling
      // This ensures that "9am America/New_York" stays 9am regardless of DST
      const timezone = event.timezone || 'America/New_York';

      // Get the local time (in the event's timezone) from the original event
      const localTime = getLocalTimeComponents(eventStartDate, timezone);

      // Create the instance start time for this occurrence date, preserving the local time
      // This handles DST: 9am EST and 9am EDT will have different UTC times
      const instanceStart = createDateInTimezone(
        occurrence.getFullYear(),
        occurrence.getMonth(),
        occurrence.getDate(),
        localTime.hours,
        localTime.minutes,
        localTime.seconds,
        timezone
      );

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
