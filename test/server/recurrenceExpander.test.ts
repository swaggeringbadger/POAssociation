import { describe, it, expect } from 'vitest';
import {
  expandRecurringEvents,
  getRealEventId,
  isVirtualEventId,
  getOriginalDateFromVirtualId,
  type EventWithType,
  type ExpandedEvent,
} from '../../server/recurrenceExpander';

/**
 * Recurrence Expander Tests
 *
 * Tests for server-side recurring event expansion:
 * - expandRecurringEvents: Expand recurring events within a date range
 * - Exception handling (deleted/modified occurrences)
 * - Virtual event ID management
 */

// Mock event type for testing
const mockEventType = {
  id: 'type-1',
  tenantId: 'tenant-1',
  name: 'Meeting',
  color: '#3b82f6',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Helper to create mock events
function createMockEvent(overrides: Partial<EventWithType> = {}): EventWithType {
  return {
    id: 'event-1',
    tenantId: 'tenant-1',
    eventTypeId: 'type-1',
    eventType: mockEventType,
    title: 'Test Event',
    description: 'Test Description',
    startDatetime: new Date('2025-01-15T10:00:00Z'),
    endDatetime: new Date('2025-01-15T11:00:00Z'),
    location: 'Conference Room',
    isAllDay: false,
    status: 'scheduled',
    recurrenceRule: null,
    recurrenceEndDate: null,
    parentEventId: null,
    exceptionDates: null,
    originalOccurrenceDate: null,
    isPublic: true,
    maxAttendees: null,
    createdByUserId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EventWithType;
}

describe('Recurrence Expander', () => {
  describe('expandRecurringEvents', () => {
    describe('Non-recurring events', () => {
      it('should include non-recurring event if in range', () => {
        const events = [
          createMockEvent({
            startDatetime: new Date('2025-01-15T10:00:00Z'),
            endDatetime: new Date('2025-01-15T11:00:00Z'),
          }),
        ];
        const rangeStart = new Date('2025-01-01T00:00:00Z');
        const rangeEnd = new Date('2025-01-31T23:59:59Z');

        const result = expandRecurringEvents(events, [], rangeStart, rangeEnd);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('event-1');
        expect(result[0].isRecurrenceInstance).toBeUndefined();
      });

      it('should exclude non-recurring event if outside range', () => {
        const events = [
          createMockEvent({
            startDatetime: new Date('2025-02-15T10:00:00Z'),
            endDatetime: new Date('2025-02-15T11:00:00Z'),
          }),
        ];
        const rangeStart = new Date('2025-01-01T00:00:00Z');
        const rangeEnd = new Date('2025-01-31T23:59:59Z');

        const result = expandRecurringEvents(events, [], rangeStart, rangeEnd);

        expect(result).toHaveLength(0);
      });
    });

    describe('Recurring events', () => {
      it('should expand daily recurring event', () => {
        const events = [
          createMockEvent({
            id: 'recurring-1',
            startDatetime: new Date('2025-01-01T10:00:00Z'),
            endDatetime: new Date('2025-01-01T11:00:00Z'),
            recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
          }),
        ];
        const rangeStart = new Date('2025-01-10T00:00:00Z');
        const rangeEnd = new Date('2025-01-15T23:59:59Z');

        const result = expandRecurringEvents(events, [], rangeStart, rangeEnd);

        // Should have instances for Jan 10-15 (6 days)
        expect(result.length).toBeGreaterThanOrEqual(5);

        // All instances should be marked as recurrence instances
        result.forEach(event => {
          expect(event.isRecurrenceInstance).toBe(true);
          expect(event.seriesId).toBe('recurring-1');
        });
      });

      it('should expand weekly recurring event', () => {
        const events = [
          createMockEvent({
            id: 'recurring-2',
            startDatetime: new Date('2025-01-06T10:00:00Z'), // Monday
            endDatetime: new Date('2025-01-06T11:00:00Z'),
            recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1',
          }),
        ];
        const rangeStart = new Date('2025-01-01T00:00:00Z');
        const rangeEnd = new Date('2025-01-31T23:59:59Z');

        const result = expandRecurringEvents(events, [], rangeStart, rangeEnd);

        // Should have instances for 4-5 Mondays in January
        expect(result.length).toBeGreaterThanOrEqual(4);

        // All should be on Mondays
        result.forEach(event => {
          const date = new Date(event.startDatetime);
          expect(date.getDay()).toBe(1); // Monday
        });
      });

      it('should generate virtual IDs for recurring instances', () => {
        const events = [
          createMockEvent({
            id: 'recurring-3',
            startDatetime: new Date('2025-01-15T10:00:00Z'),
            endDatetime: new Date('2025-01-15T11:00:00Z'),
            recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
          }),
        ];
        const rangeStart = new Date('2025-01-15T00:00:00Z');
        const rangeEnd = new Date('2025-01-17T23:59:59Z');

        const result = expandRecurringEvents(events, [], rangeStart, rangeEnd);

        // Virtual IDs should be in format: parentId_YYYY-MM-DD
        result.forEach(event => {
          expect(event.id).toMatch(/^recurring-3_\d{4}-\d{2}-\d{2}$/);
        });
      });

      it('should preserve event duration for recurring instances', () => {
        const events = [
          createMockEvent({
            id: 'recurring-4',
            startDatetime: new Date('2025-01-15T10:00:00Z'),
            endDatetime: new Date('2025-01-15T12:30:00Z'), // 2.5 hour event
            recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
          }),
        ];
        const rangeStart = new Date('2025-01-16T00:00:00Z');
        const rangeEnd = new Date('2025-01-17T23:59:59Z');

        const result = expandRecurringEvents(events, [], rangeStart, rangeEnd);

        result.forEach(event => {
          const start = new Date(event.startDatetime);
          const end = new Date(event.endDatetime);
          const duration = end.getTime() - start.getTime();
          expect(duration).toBe(2.5 * 60 * 60 * 1000); // 2.5 hours in ms
        });
      });
    });

    describe('Exception dates (deleted occurrences)', () => {
      it('should skip occurrences with exception dates', () => {
        const events = [
          createMockEvent({
            id: 'recurring-5',
            startDatetime: new Date('2025-01-15T10:00:00Z'),
            endDatetime: new Date('2025-01-15T11:00:00Z'),
            recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
            exceptionDates: '["2025-01-16","2025-01-18"]', // Skip Jan 16 and 18 (JSON format)
          }),
        ];
        const rangeStart = new Date('2025-01-15T00:00:00Z');
        const rangeEnd = new Date('2025-01-20T23:59:59Z');

        const result = expandRecurringEvents(events, [], rangeStart, rangeEnd);

        const dates = result.map(e => e.originalDate);
        expect(dates).not.toContain('2025-01-16');
        expect(dates).not.toContain('2025-01-18');
        expect(dates).toContain('2025-01-15');
        expect(dates).toContain('2025-01-17');
        expect(dates).toContain('2025-01-19');
      });
    });

    describe('Exception events (modified occurrences)', () => {
      it('should use exception event instead of generated instance', () => {
        const baseEvent = createMockEvent({
          id: 'recurring-6',
          title: 'Original Title',
          startDatetime: new Date('2025-01-15T10:00:00Z'),
          endDatetime: new Date('2025-01-15T11:00:00Z'),
          recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
        });

        const exceptionEvent = createMockEvent({
          id: 'exception-1',
          title: 'Modified Title',
          startDatetime: new Date('2025-01-16T14:00:00Z'), // Different time
          endDatetime: new Date('2025-01-16T15:00:00Z'),
          parentEventId: 'recurring-6',
          originalOccurrenceDate: '2025-01-16',
        });

        const result = expandRecurringEvents(
          [baseEvent],
          [exceptionEvent],
          new Date('2025-01-15T00:00:00Z'),
          new Date('2025-01-17T23:59:59Z')
        );

        // Find the Jan 16 instance
        const jan16Event = result.find(e => e.originalDate === '2025-01-16');
        expect(jan16Event).toBeDefined();
        expect(jan16Event?.title).toBe('Modified Title');
        expect(jan16Event?.id).toBe('exception-1');
      });
    });

    describe('Sorting', () => {
      it('should sort results by start datetime', () => {
        const events = [
          createMockEvent({
            id: 'event-late',
            startDatetime: new Date('2025-01-20T10:00:00Z'),
            endDatetime: new Date('2025-01-20T11:00:00Z'),
          }),
          createMockEvent({
            id: 'event-early',
            startDatetime: new Date('2025-01-10T10:00:00Z'),
            endDatetime: new Date('2025-01-10T11:00:00Z'),
          }),
          createMockEvent({
            id: 'event-mid',
            startDatetime: new Date('2025-01-15T10:00:00Z'),
            endDatetime: new Date('2025-01-15T11:00:00Z'),
          }),
        ];
        const rangeStart = new Date('2025-01-01T00:00:00Z');
        const rangeEnd = new Date('2025-01-31T23:59:59Z');

        const result = expandRecurringEvents(events, [], rangeStart, rangeEnd);

        // Verify sorted order
        for (let i = 1; i < result.length; i++) {
          const prevDate = new Date(result[i - 1].startDatetime);
          const currDate = new Date(result[i].startDatetime);
          expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle empty event array', () => {
        const result = expandRecurringEvents(
          [],
          [],
          new Date('2025-01-01T00:00:00Z'),
          new Date('2025-01-31T23:59:59Z')
        );
        expect(result).toHaveLength(0);
      });

      it('should skip events with parentEventId in main event list', () => {
        const events = [
          createMockEvent({
            id: 'child-event',
            parentEventId: 'parent-event', // This is an exception event
            startDatetime: new Date('2025-01-15T10:00:00Z'),
            endDatetime: new Date('2025-01-15T11:00:00Z'),
          }),
        ];

        const result = expandRecurringEvents(
          events,
          [],
          new Date('2025-01-01T00:00:00Z'),
          new Date('2025-01-31T23:59:59Z')
        );

        // Should skip exception events in main list
        expect(result).toHaveLength(0);
      });
    });
  });

  describe('getRealEventId', () => {
    it('should return original ID for non-virtual IDs', () => {
      expect(getRealEventId('event-123')).toBe('event-123');
      expect(getRealEventId('abc-def-ghi')).toBe('abc-def-ghi');
    });

    it('should extract real ID from virtual ID', () => {
      expect(getRealEventId('event-123_2025-01-15')).toBe('event-123');
      expect(getRealEventId('abc-def_2025-12-31')).toBe('abc-def');
    });

    it('should handle UUIDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(getRealEventId(uuid)).toBe(uuid);
      expect(getRealEventId(`${uuid}_2025-01-15`)).toBe(uuid);
    });
  });

  describe('isVirtualEventId', () => {
    it('should return false for non-virtual IDs', () => {
      expect(isVirtualEventId('event-123')).toBe(false);
      expect(isVirtualEventId('abc-def-ghi')).toBe(false);
      expect(isVirtualEventId('event_notadate')).toBe(false);
    });

    it('should return true for virtual IDs', () => {
      expect(isVirtualEventId('event-123_2025-01-15')).toBe(true);
      expect(isVirtualEventId('abc-def_2025-12-31')).toBe(true);
    });

    it('should validate date format', () => {
      expect(isVirtualEventId('event_2025-1-15')).toBe(false); // Missing leading zero
      expect(isVirtualEventId('event_25-01-15')).toBe(false); // Wrong year format
      expect(isVirtualEventId('event_2025-13-15')).toBe(true); // Invalid month but matches pattern
    });
  });

  describe('getOriginalDateFromVirtualId', () => {
    it('should return null for non-virtual IDs', () => {
      expect(getOriginalDateFromVirtualId('event-123')).toBeNull();
      expect(getOriginalDateFromVirtualId('abc-def-ghi')).toBeNull();
    });

    it('should extract date from virtual ID', () => {
      expect(getOriginalDateFromVirtualId('event-123_2025-01-15')).toBe('2025-01-15');
      expect(getOriginalDateFromVirtualId('abc-def_2025-12-31')).toBe('2025-12-31');
    });
  });
});
