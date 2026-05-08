/** Local calendar date as YYYY-MM-DD (no UTC shift). */
export function formatTodayISO() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function calculateDaysLeft(dateStr) {
  const eventDate = parseDateLocal(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
}

export function formatFullDate(dateStr) {
  return parseDateLocal(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

export function getDayOfWeek(dateStr) {
  return parseDateLocal(dateStr).toLocaleDateString('en-GB', { weekday: 'short' });
}

export function getNextOccurrence(anchorDateStr, recurrence, { endDate = null, count = null } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ay, am, ad] = anchorDateStr.split('-').map(Number);
  let y = ay, m = am, d = ad;
  const anchor = new Date(ay, am - 1, ad);

  function toDate(yr, mo, dy) {
    return new Date(yr, mo - 1, dy);
  }

  function formatDate(yr, mo, dy) {
    return `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
  }

  function checkEndConditions(candidateStr) {
    if (endDate && candidateStr > endDate) return null;
    if (count !== null) {
      let occurrencesSoFar;
      if (recurrence === 'weekly') {
        occurrencesSoFar = Math.floor((today - anchor) / (7 * 86400000)) + 1;
      } else {
        occurrencesSoFar = 0;
        let cy = ay, cm = am;
        while (true) {
          const candidate = recurrence === 'yearly'
            ? toDate(cy, cm, ad)
            : toDate(cy, cm, ad);
          if (candidate > today) break;
          occurrencesSoFar++;
          if (recurrence === 'yearly') cy++;
          else { cm++; if (cm > 12) { cm = 1; cy++; } }
        }
      }
      if (occurrencesSoFar >= count) return null;
    }
    return candidateStr;
  }

  if (recurrence === 'yearly') {
    y = today.getFullYear();
    if (toDate(y, m, d) < today) y += 1;
    return checkEndConditions(formatDate(y, m, d));
  }

  if (recurrence === 'monthly') {
    y = today.getFullYear();
    m = today.getMonth() + 1;
    if (toDate(y, m, d) < today) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    // If d doesn't exist in target month (e.g. day 31 in June), advance month
    while (new Date(y, m - 1, d).getMonth() !== m - 1) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return checkEndConditions(formatDate(y, m, d));
  }

  if (recurrence === 'weekly') {
    const diffDays = Math.ceil((today - anchor) / (1000 * 60 * 60 * 24));
    const weeksAhead = diffDays > 0 ? Math.ceil(diffDays / 7) : 0;
    const next = new Date(ay, am - 1, ad + weeksAhead * 7);
    return checkEndConditions(formatDate(next.getFullYear(), next.getMonth() + 1, next.getDate()));
  }

  return anchorDateStr;
}

export function getEffectiveDate(event) {
  if (!event.recurrence) return event.date;
  const result = getNextOccurrence(event.date, event.recurrence, {
    endDate: event.recurrenceEndDate ?? null,
    count: event.recurrenceCount ?? null,
  });
  return result ?? (event.recurrenceEndDate ?? event.date);
}

// Returns days elapsed since dateStr (positive = past, negative = future)
export function calculateDaysSince(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const eventDate = new Date(y, m - 1, d);
  return Math.floor((today - eventDate) / (1000 * 60 * 60 * 24));
}

export const COUNT_UP_MILESTONES = [30, 60, 90, 180, 365, 500, 730, 1000];

export function formatRecurrenceLabel(anchorDateStr, recurrence) {
  const date = parseDateLocal(anchorDateStr);
  if (recurrence === 'weekly') {
    const day = date.toLocaleDateString('en-GB', { weekday: 'long' });
    return `Every ${day}`;
  }
  if (recurrence === 'monthly') {
    const d = date.getDate();
    const suffix = d === 1 || d === 21 || d === 31 ? 'st'
      : d === 2 || d === 22 ? 'nd'
      : d === 3 || d === 23 ? 'rd'
      : 'th';
    return `Every month on the ${d}${suffix}`;
  }
  if (recurrence === 'yearly') {
    const label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    return `Every year on ${label}`;
  }
  return '';
}
