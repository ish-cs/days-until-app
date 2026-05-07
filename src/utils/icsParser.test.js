import { describe, it, expect } from 'vitest';
import { parseIcs } from './icsParser.js';

const TODAY = new Date(2025, 0, 1); // Jan 1 2025

function makeEvent(summary, dtstart) {
  return [
    'BEGIN:VEVENT',
    summary ? `SUMMARY:${summary}` : null,
    dtstart ? `DTSTART;VALUE=DATE:${dtstart}` : null,
    'END:VEVENT',
  ].filter(Boolean).join('\n');
}

function wrapCal(...events) {
  return ['BEGIN:VCALENDAR', ...events, 'END:VCALENDAR'].join('\n');
}

describe('parseIcs', () => {
  it('empty ICS returns zeros', () => {
    const result = parseIcs('BEGIN:VCALENDAR\nEND:VCALENDAR', TODAY);
    expect(result).toEqual({ events: [], totalParsed: 0, skipped: 0 });
  });

  it('1 event within next week → imported', () => {
    const ics = wrapCal(makeEvent('My Event', '20250108')); // Jan 8 2025
    const result = parseIcs(ics, TODAY);
    expect(result.totalParsed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ name: 'My Event', date: '2025-01-08' });
  });

  it('1 event 2 years from now → skipped', () => {
    const ics = wrapCal(makeEvent('Far Future', '20270101')); // Jan 1 2027
    const result = parseIcs(ics, TODAY);
    expect(result.totalParsed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.events).toHaveLength(0);
  });

  it('1 event in the past → skipped', () => {
    const ics = wrapCal(makeEvent('Past Event', '20241201')); // Dec 1 2024
    const result = parseIcs(ics, TODAY);
    expect(result.totalParsed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.events).toHaveLength(0);
  });

  it('3 events: 2 in range, 1 outside → correct counts', () => {
    const ics = wrapCal(
      makeEvent('Soon', '20250615'),      // in range
      makeEvent('Also Soon', '20251201'), // in range
      makeEvent('Too Late', '20260201'),  // outside (> Jan 1 2026)
    );
    const result = parseIcs(ics, TODAY);
    expect(result.totalParsed).toBe(3);
    expect(result.events).toHaveLength(2);
    expect(result.skipped).toBe(1);
  });

  it('event with no SUMMARY → not counted in totalParsed', () => {
    const ics = wrapCal(
      'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20250110\nEND:VEVENT'
    );
    const result = parseIcs(ics, TODAY);
    expect(result.totalParsed).toBe(0);
    expect(result.events).toHaveLength(0);
  });
});
