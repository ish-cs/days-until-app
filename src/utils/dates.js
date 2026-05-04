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

export function getNextOccurrence(anchorDateStr, recurrence) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ay, am, ad] = anchorDateStr.split('-').map(Number);
  let y = ay, m = am, d = ad;

  function toDate(yr, mo, dy) {
    return new Date(yr, mo - 1, dy);
  }

  if (recurrence === 'yearly') {
    y = today.getFullYear();
    if (toDate(y, m, d) < today) y += 1;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
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
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  if (recurrence === 'weekly') {
    const anchor = new Date(ay, am - 1, ad);
    const diffDays = Math.ceil((today - anchor) / (1000 * 60 * 60 * 24));
    const weeksAhead = diffDays > 0 ? Math.ceil(diffDays / 7) : 0;
    const next = new Date(ay, am - 1, ad + weeksAhead * 7);
    const ny = next.getFullYear();
    const nm = String(next.getMonth() + 1).padStart(2, '0');
    const nd = String(next.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }

  return anchorDateStr;
}

export function getEffectiveDate(event) {
  return event.recurrence
    ? getNextOccurrence(event.date, event.recurrence)
    : event.date;
}
