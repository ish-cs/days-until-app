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
