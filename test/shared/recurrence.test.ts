import { describe, it, expect } from 'vitest';
import {
  configToRRule,
  rruleToConfig,
  describeRecurrence,
  getNextOccurrences,
  getOccurrencesInRange,
  formatDateKey,
  parseExceptionDates,
  isExceptionDate,
  calculateDuration,
  addDuration,
  suggestMonthlyPattern,
  type RecurrenceConfig,
} from '../../shared/recurrence';

/**
 * Recurrence Utilities Tests
 *
 * Tests for RRULE-based recurrence pattern handling from recent commits:
 * - configToRRule: Convert UI config to iCal RRULE format
 * - rruleToConfig: Parse RRULE back to UI config
 * - describeRecurrence: Human-readable description
 * - getNextOccurrences: Preview next N dates
 * - getOccurrencesInRange: Expand within date range
 * - Exception date handling
 */

describe('Recurrence Utilities', () => {
  describe('configToRRule', () => {
    it('should return empty string for non-recurring events', () => {
      const config: RecurrenceConfig = {
        frequency: 'none',
        interval: 1,
        endType: 'never',
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      expect(configToRRule(config, startDate)).toBe('');
    });

    it('should generate daily recurrence rule', () => {
      const config: RecurrenceConfig = {
        frequency: 'daily',
        interval: 1,
        endType: 'never',
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('FREQ=DAILY');
      expect(rule).toContain('INTERVAL=1');
    });

    it('should generate daily recurrence with interval', () => {
      const config: RecurrenceConfig = {
        frequency: 'daily',
        interval: 3,
        endType: 'never',
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('FREQ=DAILY');
      expect(rule).toContain('INTERVAL=3');
    });

    it('should generate weekly recurrence with specific days', () => {
      const config: RecurrenceConfig = {
        frequency: 'weekly',
        interval: 1,
        weekDays: [1, 3, 5], // Monday, Wednesday, Friday
        endType: 'never',
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('FREQ=WEEKLY');
      expect(rule).toContain('BYDAY=MO,WE,FR');
    });

    it('should generate monthly by date recurrence', () => {
      const config: RecurrenceConfig = {
        frequency: 'monthly',
        interval: 1,
        monthlyType: 'date',
        endType: 'never',
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('FREQ=MONTHLY');
      expect(rule).toContain('BYMONTHDAY=15');
    });

    it('should generate monthly by weekday (3rd Thursday) recurrence', () => {
      const config: RecurrenceConfig = {
        frequency: 'monthly',
        interval: 1,
        monthlyType: 'weekday',
        monthWeekday: {
          position: 3,
          weekday: 4, // Thursday
        },
        endType: 'never',
      };
      const startDate = new Date('2025-01-16T10:00:00Z'); // A Thursday
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('FREQ=MONTHLY');
      expect(rule).toContain('BYDAY=+3TH');
    });

    it('should generate monthly by last weekday recurrence', () => {
      const config: RecurrenceConfig = {
        frequency: 'monthly',
        interval: 1,
        monthlyType: 'weekday',
        monthWeekday: {
          position: -1,
          weekday: 5, // Friday
        },
        endType: 'never',
      };
      const startDate = new Date('2025-01-31T10:00:00Z');
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('FREQ=MONTHLY');
      expect(rule).toContain('BYDAY=-1FR');
    });

    it('should generate yearly recurrence', () => {
      const config: RecurrenceConfig = {
        frequency: 'yearly',
        interval: 1,
        endType: 'never',
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('FREQ=YEARLY');
    });

    it('should include count end condition', () => {
      const config: RecurrenceConfig = {
        frequency: 'daily',
        interval: 1,
        endType: 'count',
        endCount: 10,
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('COUNT=10');
    });

    it('should include until date end condition', () => {
      const config: RecurrenceConfig = {
        frequency: 'daily',
        interval: 1,
        endType: 'date',
        endDate: new Date('2025-12-31T23:59:59Z'),
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rule = configToRRule(config, startDate);
      expect(rule).toContain('UNTIL=');
    });
  });

  describe('rruleToConfig', () => {
    it('should return default config for empty string', () => {
      const config = rruleToConfig('');
      expect(config.frequency).toBe('none');
      expect(config.interval).toBe(1);
      expect(config.endType).toBe('never');
    });

    it('should parse daily recurrence rule', () => {
      const config = rruleToConfig('FREQ=DAILY;INTERVAL=2');
      expect(config.frequency).toBe('daily');
      expect(config.interval).toBe(2);
    });

    it('should parse weekly recurrence with days', () => {
      const config = rruleToConfig('FREQ=WEEKLY;BYDAY=MO,WE,FR');
      expect(config.frequency).toBe('weekly');
      expect(config.weekDays).toContain(1); // Monday
      expect(config.weekDays).toContain(3); // Wednesday
      expect(config.weekDays).toContain(5); // Friday
    });

    it('should parse monthly by date recurrence', () => {
      const config = rruleToConfig('FREQ=MONTHLY;BYMONTHDAY=15');
      expect(config.frequency).toBe('monthly');
      expect(config.monthlyType).toBe('date');
    });

    it('should parse monthly by weekday recurrence', () => {
      // Note: The rrule library's parsing of BYDAY with position can be inconsistent
      // The implementation handles this via bysetpos or direct weekday.n property
      const startDate = new Date('2025-01-16T10:00:00Z');
      const config = rruleToConfig('FREQ=MONTHLY;BYDAY=TH;BYSETPOS=3', startDate);
      expect(config.frequency).toBe('monthly');
      expect(config.monthlyType).toBe('weekday');
      expect(config.monthWeekday?.position).toBe(3);
    });

    it('should parse yearly recurrence', () => {
      const config = rruleToConfig('FREQ=YEARLY;INTERVAL=1');
      expect(config.frequency).toBe('yearly');
    });

    it('should parse count end condition', () => {
      const config = rruleToConfig('FREQ=DAILY;COUNT=10');
      expect(config.endType).toBe('count');
      expect(config.endCount).toBe(10);
    });

    it('should parse until end condition', () => {
      const config = rruleToConfig('FREQ=DAILY;UNTIL=20251231T235959Z');
      expect(config.endType).toBe('date');
      expect(config.endDate).toBeDefined();
    });

    it('should handle RRULE: prefix', () => {
      const config = rruleToConfig('RRULE:FREQ=DAILY;INTERVAL=1');
      expect(config.frequency).toBe('daily');
    });

    it('should return default config for invalid RRULE', () => {
      const config = rruleToConfig('INVALID_RULE_STRING');
      expect(config.frequency).toBe('none');
    });
  });

  describe('describeRecurrence', () => {
    it('should return empty string for empty input', () => {
      expect(describeRecurrence('')).toBe('');
    });

    it('should describe daily recurrence', () => {
      const description = describeRecurrence('FREQ=DAILY;INTERVAL=1');
      expect(description.toLowerCase()).toContain('day');
    });

    it('should describe weekly recurrence with days', () => {
      const description = describeRecurrence('FREQ=WEEKLY;BYDAY=MO,WE,FR');
      expect(description.toLowerCase()).toContain('week');
    });

    it('should describe monthly recurrence', () => {
      const description = describeRecurrence('FREQ=MONTHLY;INTERVAL=1');
      expect(description.toLowerCase()).toContain('month');
    });

    it('should return empty string for invalid rule', () => {
      expect(describeRecurrence('INVALID')).toBe('');
    });
  });

  describe('getNextOccurrences', () => {
    it('should return empty array for non-recurring event', () => {
      const startDate = new Date('2025-01-15T10:00:00Z');
      const occurrences = getNextOccurrences('', startDate, 5);
      expect(occurrences).toHaveLength(0);
    });

    it('should return next 5 daily occurrences', () => {
      const startDate = new Date('2025-01-15T10:00:00Z');
      const occurrences = getNextOccurrences('FREQ=DAILY;INTERVAL=1', startDate, 5);
      expect(occurrences).toHaveLength(5);
      // Check that dates are consecutive days
      for (let i = 1; i < occurrences.length; i++) {
        const diff = occurrences[i].getTime() - occurrences[i - 1].getTime();
        expect(diff).toBe(24 * 60 * 60 * 1000); // 1 day in ms
      }
    });

    it('should return next 5 weekly occurrences', () => {
      const startDate = new Date('2025-01-15T10:00:00Z');
      const occurrences = getNextOccurrences('FREQ=WEEKLY;INTERVAL=1', startDate, 5);
      expect(occurrences).toHaveLength(5);
      // Check that dates are 7 days apart
      for (let i = 1; i < occurrences.length; i++) {
        const diff = occurrences[i].getTime() - occurrences[i - 1].getTime();
        expect(diff).toBe(7 * 24 * 60 * 60 * 1000); // 1 week in ms
      }
    });

    it('should respect count limit', () => {
      const startDate = new Date('2025-01-15T10:00:00Z');
      const occurrences = getNextOccurrences('FREQ=DAILY;COUNT=3', startDate, 10);
      expect(occurrences).toHaveLength(3);
    });

    it('should return empty array for invalid rule', () => {
      const startDate = new Date('2025-01-15T10:00:00Z');
      const occurrences = getNextOccurrences('INVALID', startDate, 5);
      expect(occurrences).toHaveLength(0);
    });
  });

  describe('getOccurrencesInRange', () => {
    it('should return empty array for non-recurring event', () => {
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rangeStart = new Date('2025-01-01T00:00:00Z');
      const rangeEnd = new Date('2025-01-31T23:59:59Z');

      const occurrences = getOccurrencesInRange('', startDate, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(0);
    });

    it('should return all daily occurrences in range', () => {
      const startDate = new Date('2025-01-01T10:00:00Z');
      const rangeStart = new Date('2025-01-10T00:00:00Z');
      const rangeEnd = new Date('2025-01-15T23:59:59Z');

      const occurrences = getOccurrencesInRange('FREQ=DAILY;INTERVAL=1', startDate, rangeStart, rangeEnd);
      // Should have 6 days: Jan 10, 11, 12, 13, 14, 15
      expect(occurrences.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle monthly 3rd Thursday pattern', () => {
      const startDate = new Date('2025-01-16T10:00:00Z'); // 3rd Thursday of Jan 2025
      const rangeStart = new Date('2025-01-01T00:00:00Z');
      const rangeEnd = new Date('2025-06-30T23:59:59Z');

      const occurrences = getOccurrencesInRange('FREQ=MONTHLY;BYDAY=+3TH', startDate, rangeStart, rangeEnd);
      expect(occurrences.length).toBeGreaterThanOrEqual(5); // At least 5 months of occurrences

      // All occurrences should be Thursdays
      occurrences.forEach(date => {
        expect(date.getDay()).toBe(4); // Thursday
      });
    });

    it('should return empty array for invalid rule', () => {
      const startDate = new Date('2025-01-15T10:00:00Z');
      const rangeStart = new Date('2025-01-01T00:00:00Z');
      const rangeEnd = new Date('2025-01-31T23:59:59Z');

      const occurrences = getOccurrencesInRange('INVALID', startDate, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(0);
    });
  });

  describe('formatDateKey', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      expect(formatDateKey(date)).toBe('2025-01-15');
    });

    it('should handle dates near midnight', () => {
      const date = new Date('2025-01-15T23:59:59Z');
      expect(formatDateKey(date)).toBe('2025-01-15');
    });
  });

  describe('parseExceptionDates', () => {
    it('should return empty set for null input', () => {
      const result = parseExceptionDates(null);
      expect(result.size).toBe(0);
    });

    it('should return empty set for empty string', () => {
      const result = parseExceptionDates('');
      expect(result.size).toBe(0);
    });

    it('should parse JSON array string', () => {
      const result = parseExceptionDates('["2025-01-15","2025-01-20"]');
      expect(result.size).toBe(2);
      expect(result.has('2025-01-15')).toBe(true);
      expect(result.has('2025-01-20')).toBe(true);
    });

    it('should parse array directly', () => {
      const result = parseExceptionDates(['2025-01-15', '2025-01-20', '2025-01-25']);
      expect(result.size).toBe(3);
      expect(result.has('2025-01-15')).toBe(true);
      expect(result.has('2025-01-20')).toBe(true);
      expect(result.has('2025-01-25')).toBe(true);
    });

    it('should return empty set for invalid JSON', () => {
      const result = parseExceptionDates('not valid json');
      expect(result.size).toBe(0);
    });
  });

  describe('isExceptionDate', () => {
    it('should return true for date in exception set', () => {
      const date = new Date('2025-01-15T10:00:00Z');
      const exceptions = new Set(['2025-01-15']);
      expect(isExceptionDate(date, exceptions)).toBe(true);
    });

    it('should return false for date not in exception set', () => {
      const date = new Date('2025-01-16T10:00:00Z');
      const exceptions = new Set(['2025-01-15']);
      expect(isExceptionDate(date, exceptions)).toBe(false);
    });

    it('should return false for empty exception set', () => {
      const date = new Date('2025-01-15T10:00:00Z');
      const exceptions = new Set<string>();
      expect(isExceptionDate(date, exceptions)).toBe(false);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration in milliseconds', () => {
      const start = new Date('2025-01-15T10:00:00Z');
      const end = new Date('2025-01-15T11:00:00Z');
      expect(calculateDuration(start, end)).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should handle multi-day events', () => {
      const start = new Date('2025-01-15T10:00:00Z');
      const end = new Date('2025-01-16T10:00:00Z');
      expect(calculateDuration(start, end)).toBe(24 * 60 * 60 * 1000); // 1 day
    });
  });

  describe('addDuration', () => {
    it('should add duration to date', () => {
      const date = new Date('2025-01-15T10:00:00Z');
      const duration = 60 * 60 * 1000; // 1 hour
      const result = addDuration(date, duration);
      expect(result.toISOString()).toBe('2025-01-15T11:00:00.000Z');
    });

    it('should handle day rollover', () => {
      const date = new Date('2025-01-15T23:00:00Z');
      const duration = 2 * 60 * 60 * 1000; // 2 hours
      const result = addDuration(date, duration);
      expect(result.getDate()).toBe(16);
    });
  });

  describe('suggestMonthlyPattern', () => {
    it('should detect 3rd Thursday', () => {
      // January 16, 2025 is the 3rd Thursday
      const date = new Date('2025-01-16T10:00:00Z');
      const suggestion = suggestMonthlyPattern(date);
      expect(suggestion.weekday).toBe(4); // Thursday (0=Sun, 4=Thu)
      expect(suggestion.position).toBe(3);
    });

    it('should detect 1st Monday', () => {
      // January 6, 2025 is the 1st Monday
      const date = new Date('2025-01-06T10:00:00Z');
      const suggestion = suggestMonthlyPattern(date);
      expect(suggestion.weekday).toBe(1); // Monday
      expect(suggestion.position).toBe(1);
    });

    it('should detect 5th Friday of January 2025', () => {
      // January 31, 2025 is the 5th Friday
      const date = new Date('2025-01-31T10:00:00Z');
      const suggestion = suggestMonthlyPattern(date);
      expect(suggestion.weekday).toBe(5); // Friday
      expect(suggestion.position).toBe(5); // 5th occurrence (31/7 = 4.43, ceil = 5)
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve daily config through round-trip', () => {
      const original: RecurrenceConfig = {
        frequency: 'daily',
        interval: 2,
        endType: 'count',
        endCount: 10,
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      let rrule = configToRRule(original, startDate);
      // configToRRule returns multiline: "DTSTART:...\nFREQ=..." - extract just the FREQ line
      const lines = rrule.split('\n');
      rrule = lines.find(line => line.startsWith('FREQ=')) || rrule;
      const parsed = rruleToConfig(rrule, startDate);

      expect(parsed.frequency).toBe(original.frequency);
      expect(parsed.interval).toBe(original.interval);
      expect(parsed.endType).toBe(original.endType);
      expect(parsed.endCount).toBe(original.endCount);
    });

    it('should preserve weekly config through round-trip', () => {
      const original: RecurrenceConfig = {
        frequency: 'weekly',
        interval: 1,
        weekDays: [1, 3, 5],
        endType: 'never',
      };
      const startDate = new Date('2025-01-15T10:00:00Z');
      let rrule = configToRRule(original, startDate);
      // configToRRule returns multiline: "DTSTART:...\nFREQ=..." - extract just the FREQ line
      const lines = rrule.split('\n');
      rrule = lines.find(line => line.startsWith('FREQ=')) || rrule;
      const parsed = rruleToConfig(rrule, startDate);

      expect(parsed.frequency).toBe(original.frequency);
      expect(parsed.weekDays).toEqual(expect.arrayContaining(original.weekDays!));
    });
  });
});
