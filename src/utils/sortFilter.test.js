import { describe, it, expect } from 'vitest';
import { filterEvents, sortEvents } from './sortFilter.js';

// Far-future dates so ordering is stable regardless of when tests run.
// sooner is always < later.
const SOONER = { id: '1', name: 'Alpha', date: '2099-01-01' };
const LATER  = { id: '2', name: 'Banana', date: '2099-12-31' };
const APPLE  = { id: '3', name: 'Apple', date: '2099-06-15' };

describe('filterEvents', () => {
  const events = [
    { id: '1', name: 'Dentist Appointment', date: '2099-03-01' },
    { id: '2', name: 'Birthday Party', date: '2099-04-01' },
    { id: '3', name: 'dentist followup', date: '2099-05-01' },
  ];

  it('empty search returns all events', () => {
    expect(filterEvents(events, '')).toHaveLength(3);
  });

  it('whitespace-only search returns all events', () => {
    expect(filterEvents(events, '   ')).toHaveLength(3);
  });

  it("'dentist' matches both dentist events case-insensitively", () => {
    const result = filterEvents(events, 'dentist');
    expect(result).toHaveLength(2);
    expect(result.map(e => e.name)).toContain('Dentist Appointment');
    expect(result.map(e => e.name)).toContain('dentist followup');
  });

  it('no match returns empty array', () => {
    expect(filterEvents(events, 'zzznomatch')).toHaveLength(0);
  });
});

describe('sortEvents', () => {
  it("'soonest' puts daysLeft=1 before daysLeft=5", () => {
    const result = sortEvents([LATER, SOONER], 'soonest');
    expect(result[0]).toBe(SOONER);
    expect(result[1]).toBe(LATER);
  });

  it("'latest' puts larger daysLeft first", () => {
    const result = sortEvents([SOONER, LATER], 'latest');
    expect(result[0]).toBe(LATER);
    expect(result[1]).toBe(SOONER);
  });

  it("'az' sorts alphabetically ascending", () => {
    const result = sortEvents([LATER, APPLE, SOONER], 'az');
    expect(result[0].name).toBe('Alpha');
    expect(result[1].name).toBe('Apple');
    expect(result[2].name).toBe('Banana');
  });

  it("'za' sorts alphabetically descending", () => {
    const result = sortEvents([SOONER, APPLE, LATER], 'za');
    expect(result[0].name).toBe('Banana');
    expect(result[1].name).toBe('Apple');
    expect(result[2].name).toBe('Alpha');
  });

  it("default (undefined order) behaves like 'soonest'", () => {
    const result = sortEvents([LATER, SOONER], undefined);
    expect(result[0]).toBe(SOONER);
  });

  it('does not mutate the input array', () => {
    const input = [LATER, SOONER];
    sortEvents(input, 'soonest');
    expect(input[0]).toBe(LATER);
  });
});
