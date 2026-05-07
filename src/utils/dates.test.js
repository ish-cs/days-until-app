import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTodayISO,
  parseDateLocal,
  calculateDaysLeft,
  formatFullDate,
  getDayOfWeek,
  getNextOccurrence,
  getEffectiveDate,
  formatRecurrenceLabel,
} from './dates.js';

// ─── formatTodayISO ───────────────────────────────────────────────────────────

describe('formatTodayISO', () => {
  it('returns a string matching YYYY-MM-DD', () => {
    expect(formatTodayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches the local date, not UTC date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(formatTodayISO()).toBe(expected);
  });
});

// ─── parseDateLocal ───────────────────────────────────────────────────────────

describe('parseDateLocal', () => {
  it('parses year correctly', () => {
    expect(parseDateLocal('2025-01-15').getFullYear()).toBe(2025);
  });

  it('parses month as January (0) for 2025-01-15, not shifted', () => {
    expect(parseDateLocal('2025-01-15').getMonth()).toBe(0);
  });

  it('parses day correctly', () => {
    expect(parseDateLocal('2025-01-15').getDate()).toBe(15);
  });

  it('parses December correctly', () => {
    const d = parseDateLocal('2024-12-31');
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });
});

// ─── calculateDaysLeft ────────────────────────────────────────────────────────

describe('calculateDaysLeft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 6, 12, 0, 0)); // 2026-05-06 noon local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for today', () => {
    expect(calculateDaysLeft('2026-05-06')).toBe(0);
  });

  it('returns 1 for tomorrow', () => {
    expect(calculateDaysLeft('2026-05-07')).toBe(1);
  });

  it('returns -1 for yesterday', () => {
    expect(calculateDaysLeft('2026-05-05')).toBe(-1);
  });

  it('returns a positive integer for a future date', () => {
    expect(calculateDaysLeft('2026-06-06')).toBe(31);
  });
});

// ─── formatFullDate ───────────────────────────────────────────────────────────

describe('formatFullDate', () => {
  it('formats 2025-01-15 as "15 January 2025"', () => {
    expect(formatFullDate('2025-01-15')).toBe('15 January 2025');
  });

  it('formats 2024-12-31 as "31 December 2024"', () => {
    expect(formatFullDate('2024-12-31')).toBe('31 December 2024');
  });
});

// ─── getDayOfWeek ─────────────────────────────────────────────────────────────

describe('getDayOfWeek', () => {
  it('returns "Wed" for 2025-01-15 (a Wednesday)', () => {
    expect(getDayOfWeek('2025-01-15')).toBe('Wed');
  });

  it('returns "Mon" for 2025-01-13 (a Monday)', () => {
    expect(getDayOfWeek('2025-01-13')).toBe('Mon');
  });
});

// ─── getNextOccurrence ────────────────────────────────────────────────────────

describe('getNextOccurrence', () => {
  describe('weekly', () => {
    it('returns a date on the same weekday as the anchor', () => {
      // 2020-01-01 is a Wednesday
      const result = getNextOccurrence('2020-01-01', 'weekly');
      const resultDate = new Date(result + 'T00:00:00');
      expect(resultDate.getDay()).toBe(3); // 3 = Wednesday
    });

    it('returns a date >= today', () => {
      const result = getNextOccurrence('2020-01-01', 'weekly');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const resultDate = new Date(result + 'T00:00:00');
      expect(resultDate >= today).toBe(true);
    });

    it('returns a date at most 6 days in the future', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = getNextOccurrence('2020-01-01', 'weekly');
      const resultDate = new Date(result + 'T00:00:00');
      const diffDays = (resultDate - today) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(0);
      expect(diffDays).toBeLessThanOrEqual(6);
    });
  });

  describe('monthly', () => {
    it('returns a date on day 15 when anchor is the 15th', () => {
      const result = getNextOccurrence('2020-01-15', 'monthly');
      const [, , d] = result.split('-').map(Number);
      expect(d).toBe(15);
    });

    it('returns a date >= today', () => {
      const result = getNextOccurrence('2020-01-15', 'monthly');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = result.split('-').map(Number);
      expect(new Date(y, m - 1, d) >= today).toBe(true);
    });

    it('returns a date <= 31 days from today', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = getNextOccurrence('2020-01-01', 'monthly');
      const [y, m, d] = result.split('-').map(Number);
      const diff = (new Date(y, m - 1, d) - today) / (1000 * 60 * 60 * 24);
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(31);
    });
  });

  describe('yearly', () => {
    it('returns Jan 1 when anchor is 2020-01-01', () => {
      const result = getNextOccurrence('2020-01-01', 'yearly');
      const [, m, d] = result.split('-').map(Number);
      expect(m).toBe(1);
      expect(d).toBe(1);
    });

    it('returns a date >= today', () => {
      const result = getNextOccurrence('2020-01-01', 'yearly');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = result.split('-').map(Number);
      expect(new Date(y, m - 1, d) >= today).toBe(true);
    });

    it('returns a date at most ~365 days in the future', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = getNextOccurrence('2020-06-15', 'yearly');
      const [y, m, d] = result.split('-').map(Number);
      const diff = (new Date(y, m - 1, d) - today) / (1000 * 60 * 60 * 24);
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(366);
    });

    it('preserves month and day from the anchor', () => {
      const result = getNextOccurrence('2020-07-04', 'yearly');
      const [, m, d] = result.split('-').map(Number);
      expect(m).toBe(7);
      expect(d).toBe(4);
    });
  });

  describe('past anchor always returns a future date', () => {
    it('weekly past anchor', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = getNextOccurrence('2000-06-15', 'weekly');
      const [y, m, d] = result.split('-').map(Number);
      expect(new Date(y, m - 1, d) >= today).toBe(true);
    });

    it('monthly past anchor', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = getNextOccurrence('2000-06-15', 'monthly');
      const [y, m, d] = result.split('-').map(Number);
      expect(new Date(y, m - 1, d) >= today).toBe(true);
    });

    it('yearly past anchor', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = getNextOccurrence('2000-06-15', 'yearly');
      const [y, m, d] = result.split('-').map(Number);
      expect(new Date(y, m - 1, d) >= today).toBe(true);
    });
  });
});

// ─── getEffectiveDate ─────────────────────────────────────────────────────────

describe('getEffectiveDate', () => {
  it('returns event.date when there is no recurrence', () => {
    const event = { date: '2025-06-01', recurrence: null };
    expect(getEffectiveDate(event)).toBe('2025-06-01');
  });

  it('returns event.date when recurrence is undefined', () => {
    const event = { date: '2025-06-01' };
    expect(getEffectiveDate(event)).toBe('2025-06-01');
  });

  it('returns a future date string for weekly recurrence', () => {
    const event = { date: '2020-01-01', recurrence: 'weekly' };
    const result = getEffectiveDate(event);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = result.split('-').map(Number);
    expect(new Date(y, m - 1, d) >= today).toBe(true);
  });

  it('returns a future date string for monthly recurrence', () => {
    const event = { date: '2020-01-15', recurrence: 'monthly' };
    const result = getEffectiveDate(event);
    const [, , d] = result.split('-').map(Number);
    expect(d).toBe(15);
  });
});

// ─── formatRecurrenceLabel ────────────────────────────────────────────────────

describe('formatRecurrenceLabel', () => {
  it('weekly on a Wednesday → "Every Wednesday"', () => {
    expect(formatRecurrenceLabel('2025-01-15', 'weekly')).toBe('Every Wednesday');
  });

  it('monthly on the 1st → "Every month on the 1st"', () => {
    expect(formatRecurrenceLabel('2025-01-01', 'monthly')).toBe('Every month on the 1st');
  });

  it('monthly on the 2nd → "Every month on the 2nd"', () => {
    expect(formatRecurrenceLabel('2025-01-02', 'monthly')).toBe('Every month on the 2nd');
  });

  it('monthly on the 3rd → "Every month on the 3rd"', () => {
    expect(formatRecurrenceLabel('2025-01-03', 'monthly')).toBe('Every month on the 3rd');
  });

  it('monthly on the 4th → "Every month on the 4th"', () => {
    expect(formatRecurrenceLabel('2025-01-04', 'monthly')).toBe('Every month on the 4th');
  });

  it('monthly on the 21st → "Every month on the 21st"', () => {
    expect(formatRecurrenceLabel('2025-01-21', 'monthly')).toBe('Every month on the 21st');
  });

  it('monthly on the 22nd → "Every month on the 22nd"', () => {
    expect(formatRecurrenceLabel('2025-01-22', 'monthly')).toBe('Every month on the 22nd');
  });

  it('yearly on Jan 15 → "Every year on 15 January"', () => {
    expect(formatRecurrenceLabel('2025-01-15', 'yearly')).toBe('Every year on 15 January');
  });

  it('returns empty string for unknown recurrence', () => {
    expect(formatRecurrenceLabel('2025-01-15', 'unknown')).toBe('');
  });
});
