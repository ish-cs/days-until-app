/**
 * Parse ICS text and return { events, totalParsed, skipped }
 * events: array of { name, date } for events within [today, today+1year]
 * totalParsed: total VEVENT entries with name+date
 * skipped: totalParsed - events.length
 */
export function parseIcs(icsText, today = new Date()) {
  const lines = icsText.split(/\r?\n/);
  const events = [];
  let current = {};
  let totalParsed = 0;

  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const yearAhead = new Date(todayMidnight);
  yearAhead.setFullYear(todayMidnight.getFullYear() + 1);
  yearAhead.setHours(23, 59, 59, 999);

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
    } else if (line.startsWith('SUMMARY:')) {
      current.name = line.slice(8).trim();
    } else if (line.startsWith('DTSTART;VALUE=DATE:')) {
      const raw = line.split(':')[1].trim();
      current.date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    } else if (line.startsWith('END:VEVENT') && current.name && current.date) {
      totalParsed++;
      const [ey, em, ed] = current.date.split('-').map(Number);
      const eventDate = new Date(ey, em - 1, ed);
      if (eventDate >= todayMidnight && eventDate <= yearAhead) {
        events.push({ ...current });
      }
    }
  }

  return { events, totalParsed, skipped: totalParsed - events.length };
}
