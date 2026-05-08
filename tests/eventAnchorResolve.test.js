import { describe, it, expect } from 'vitest';
import {
  parseRelativeOffsetClause,
  nextInstanceOnOrAfter,
  tryEventAnchoredDate,
} from '../netlify/functions/eventAnchorResolve.js';
import { extractStructuredDateTime } from '../netlify/functions/dateExtract.js';

describe('eventAnchorResolve', () => {
  it('parses day/week after before clauses', () => {
    expect(parseRelativeOffsetClause('every year marathon a day after my bday')).toEqual({
      deltaDays: 1,
      refPhrase: 'my bday',
    });
    expect(parseRelativeOffsetClause('meeting one week after dog walk every week')).toEqual({
      deltaDays: 7,
      refPhrase: 'dog walk',
    });
    expect(parseRelativeOffsetClause('x 2 days before The Interview')).toEqual({
      deltaDays: -2,
      refPhrase: 'The Interview',
    });
  });

  it('nextInstanceOnOrAfter respects yearly recurrence', () => {
    expect(
      nextInstanceOnOrAfter({ name: 'Birthday', date: '2026-11-23', recurrence: 'yearly' }, '2026-05-07')
    ).toBe('2026-11-23');
    expect(
      nextInstanceOnOrAfter({ name: 'Birthday', date: '2026-11-23', recurrence: 'yearly' }, '2026-12-01')
    ).toBe('2027-11-23');
  });

  it('tryEventAnchoredDate binds full word birthday (order: every year ... a day after)', () => {
    const events = [{ name: 'Birthday', date: '2026-11-23', recurrence: 'yearly' }];
    const phrase = 'ive a marathon every year a day after my birthday ';
    expect(tryEventAnchoredDate(phrase, '2026-05-07', events)).toEqual({
      date: '2026-11-24',
    });
  });

  it('extractStructuredDateTime prefers event anchor over chrono (bday)', () => {
    const events = [{ name: 'Birthday', date: '2026-11-23', recurrence: 'yearly' }];
    const r = extractStructuredDateTime(
      'every year ive a marathon a day after my bday',
      '2026-05-07',
      events
    );
    expect(r.date).toBe('2026-11-24');
  });

  it('extractStructuredDateTime prefers event anchor for user phrase order', () => {
    const events = [{ name: 'Birthday', date: '2026-11-23', recurrence: 'yearly' }];
    const r = extractStructuredDateTime(
      'ive a marathon every year a day after my birthday ',
      '2026-05-07',
      events
    );
    expect(r.date).toBe('2026-11-24');
  });
});
