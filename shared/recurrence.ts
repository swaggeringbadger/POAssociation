// Import rrule - handles both ESM (Vite) and CJS (Node/tsx) environments
// Vite uses named exports, Node ESM uses default export
import * as rruleModule from 'rrule';

// Handle the difference between Vite (named exports) and Node ESM (default export)
const rruleDefault = (rruleModule as any).default || rruleModule;
const RRule = rruleDefault.RRule || (rruleModule as any).RRule;
const Frequency = rruleDefault.Frequency || (rruleModule as any).Frequency;
const Weekday = rruleDefault.Weekday || (rruleModule as any).Weekday;
const rrulestr = rruleDefault.rrulestr || (rruleModule as any).rrulestr;

// UI Configuration for recurrence settings
// Note: endDate can be Date or string due to JSON serialization
export interface RecurrenceConfig {
  frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  weekDays?: number[]; // 0=SU, 1=MO, 2=TU, 3=WE, 4=TH, 5=FR, 6=SA (RRule.SU.weekday format)
  monthlyType?: 'date' | 'weekday'; // Monthly by day of month vs Nth weekday
  monthWeekday?: {
    position: number; // 1-4, or -1 for last
    weekday: number; // 0-6
  };
  endType: 'never' | 'count' | 'date';
  endCount?: number;
  endDate?: Date | string; // Can be string after JSON serialization
}

// Map weekday index to RRule Weekday
const WEEKDAY_MAP = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

// Map frequency string to RRule Frequency
const FREQUENCY_MAP: Record<string, Frequency> = {
  daily: Frequency.DAILY,
  weekly: Frequency.WEEKLY,
  monthly: Frequency.MONTHLY,
  yearly: Frequency.YEARLY,
};

// Human-readable weekday names
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Ordinal position names
const POSITION_NAMES: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  '-1': 'last',
};

/**
 * Convert UI configuration to iCal RRULE string
 */
export function configToRRule(config: RecurrenceConfig, startDate: Date | string): string {
  if (config.frequency === 'none') {
    return '';
  }

  // Ensure startDate is a proper Date object
  const normalizedStartDate = startDate instanceof Date ? startDate : new Date(startDate);

  const options: Record<string, any> = {
    freq: FREQUENCY_MAP[config.frequency],
    interval: config.interval || 1,
    dtstart: normalizedStartDate,
  };

  // Weekly: specific days of week
  if (config.frequency === 'weekly' && config.weekDays?.length) {
    options.byweekday = config.weekDays.map(d => WEEKDAY_MAP[d]);
  }

  // Monthly: by date or by weekday position
  if (config.frequency === 'monthly') {
    if (config.monthlyType === 'weekday' && config.monthWeekday) {
      // e.g., 3rd Thursday = BYDAY=TH;BYSETPOS=3
      options.byweekday = WEEKDAY_MAP[config.monthWeekday.weekday].nth(config.monthWeekday.position);
    } else {
      // By day of month - use the start date's day
      options.bymonthday = normalizedStartDate.getDate();
    }
  }

  // End conditions
  if (config.endType === 'count' && config.endCount) {
    options.count = config.endCount;
  } else if (config.endType === 'date' && config.endDate) {
    // Ensure endDate is a Date object (could be string from JSON)
    options.until = config.endDate instanceof Date
      ? config.endDate
      : new Date(config.endDate);
  }

  const rule = new RRule(options);
  // rule.toString() returns "DTSTART:...\nRRULE:FREQ=..." - extract just the RRULE part
  const fullString = rule.toString();
  const rruleMatch = fullString.match(/RRULE:(.+)/);
  return rruleMatch ? rruleMatch[1] : fullString.replace('RRULE:', '');
}

/**
 * Parse RRULE string back to UI configuration
 */
export function rruleToConfig(rruleString: string, startDate?: Date): RecurrenceConfig {
  if (!rruleString) {
    return { frequency: 'none', interval: 1, endType: 'never' };
  }

  try {
    // Parse the RRULE string
    const fullRRule = rruleString.startsWith('RRULE:') ? rruleString : `RRULE:${rruleString}`;
    const rule = rrulestr(fullRRule, { dtstart: startDate || new Date() });
    const options = rule.origOptions;

    const config: RecurrenceConfig = {
      frequency: 'none',
      interval: options.interval || 1,
      endType: 'never',
    };

    // Map frequency
    switch (options.freq) {
      case Frequency.DAILY:
        config.frequency = 'daily';
        break;
      case Frequency.WEEKLY:
        config.frequency = 'weekly';
        break;
      case Frequency.MONTHLY:
        config.frequency = 'monthly';
        break;
      case Frequency.YEARLY:
        config.frequency = 'yearly';
        break;
    }

    // Weekly days
    if (options.byweekday && Array.isArray(options.byweekday)) {
      config.weekDays = options.byweekday.map((wd: any) => {
        const weekday = typeof wd === 'number' ? wd : wd.weekday;
        // Convert RRule weekday (0=MO) to our format (0=SU)
        return weekday === 6 ? 0 : weekday + 1;
      });
    }

    // Monthly pattern detection
    if (config.frequency === 'monthly') {
      if (options.byweekday && !Array.isArray(options.byweekday) && (options.byweekday as any).n) {
        config.monthlyType = 'weekday';
        const wd = options.byweekday as any;
        config.monthWeekday = {
          position: wd.n,
          weekday: wd.weekday === 6 ? 0 : wd.weekday + 1,
        };
      } else if (options.bysetpos && options.byweekday) {
        config.monthlyType = 'weekday';
        const wd = Array.isArray(options.byweekday) ? options.byweekday[0] : options.byweekday;
        const weekday = typeof wd === 'number' ? wd : (wd as any).weekday;
        config.monthWeekday = {
          position: Array.isArray(options.bysetpos) ? options.bysetpos[0] : options.bysetpos,
          weekday: weekday === 6 ? 0 : weekday + 1,
        };
      } else {
        config.monthlyType = 'date';
      }
    }

    // End conditions
    if (options.count) {
      config.endType = 'count';
      config.endCount = options.count;
    } else if (options.until) {
      config.endType = 'date';
      config.endDate = options.until;
    }

    return config;
  } catch (error) {
    console.error('Error parsing RRULE:', error);
    return { frequency: 'none', interval: 1, endType: 'never' };
  }
}

/**
 * Get human-readable description of recurrence
 */
export function describeRecurrence(rruleString: string): string {
  if (!rruleString) return '';

  try {
    const fullRRule = rruleString.startsWith('RRULE:') ? rruleString : `RRULE:${rruleString}`;
    const rule = rrulestr(fullRRule);
    return rule.toText();
  } catch {
    return '';
  }
}

/**
 * Get next N occurrences from a given start date
 */
export function getNextOccurrences(rruleString: string, startDate: Date | string, count: number = 5): Date[] {
  if (!rruleString) return [];

  try {
    const normalizedStartDate = startDate instanceof Date ? startDate : new Date(startDate);
    const fullRRule = rruleString.startsWith('RRULE:') ? rruleString : `RRULE:${rruleString}`;
    const rule = rrulestr(fullRRule, { dtstart: normalizedStartDate });
    return rule.all((_, i) => i < count);
  } catch {
    return [];
  }
}

/**
 * Get occurrences in a date range
 */
export function getOccurrencesInRange(rruleString: string, startDate: Date | string, rangeStart: Date | string, rangeEnd: Date | string): Date[] {
  if (!rruleString) return [];

  try {
    const normalizedStartDate = startDate instanceof Date ? startDate : new Date(startDate);
    const normalizedRangeStart = rangeStart instanceof Date ? rangeStart : new Date(rangeStart);
    const normalizedRangeEnd = rangeEnd instanceof Date ? rangeEnd : new Date(rangeEnd);
    const fullRRule = rruleString.startsWith('RRULE:') ? rruleString : `RRULE:${rruleString}`;
    const rule = rrulestr(fullRRule, { dtstart: normalizedStartDate });
    return rule.between(normalizedRangeStart, normalizedRangeEnd, true);
  } catch {
    return [];
  }
}

/**
 * Suggest a monthly pattern based on a date
 * e.g., if date is Dec 19, 2024 (3rd Thursday), suggest "3rd Thursday"
 */
export function suggestMonthlyPattern(date: Date | string): { position: number; weekday: number } {
  const normalizedDate = date instanceof Date ? date : new Date(date);
  const dayOfWeek = normalizedDate.getDay(); // 0=Sunday, 6=Saturday
  const dayOfMonth = normalizedDate.getDate();

  // Calculate which occurrence of this weekday in the month
  const position = Math.ceil(dayOfMonth / 7);

  return {
    position,
    weekday: dayOfWeek,
  };
}

/**
 * Parse exception dates from JSON string or array
 */
export function parseExceptionDates(exceptionDates: string | string[] | null): Set<string> {
  if (!exceptionDates) return new Set();

  try {
    const dates = typeof exceptionDates === 'string'
      ? JSON.parse(exceptionDates)
      : exceptionDates;
    return new Set(Array.isArray(dates) ? dates : []);
  } catch {
    return new Set();
  }
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date is in the exception dates set
 */
export function isExceptionDate(date: Date, exceptionDates: Set<string>): boolean {
  return exceptionDates.has(formatDateKey(date));
}

/**
 * Calculate duration between two dates in milliseconds
 */
export function calculateDuration(start: Date, end: Date): number {
  return end.getTime() - start.getTime();
}

/**
 * Add duration to a date
 */
export function addDuration(date: Date, durationMs: number): Date {
  return new Date(date.getTime() + durationMs);
}
