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
    } else if (!current.date) {
      const dateOnly = line.match(/^DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
      const dateTime = line.match(/^DTSTART(?:;[^:]*)?:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (dateOnly) {
        current.date = `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
      } else if (dateTime) {
        current.date = `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`;
      }
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

export function detectDuplicates(incoming, existing) {
  return incoming.filter(ev =>
    existing.some(ex => ex.name === ev.name && ex.date === ev.date)
  );
}
