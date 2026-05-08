// RFC 5545 ICS export utilities

function escapeICS(str) {
  return (str ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let i = 0;
  let first = true;
  while (i < bytes.length) {
    const chunk = bytes.slice(i, i + (first ? 75 : 74));
    parts.push((first ? '' : ' ') + new TextDecoder().decode(chunk));
    i += first ? 75 : 74;
    first = false;
  }
  return parts.join('\r\n');
}

export function generateUID(eventId, uid) {
  return `${eventId}-${uid}@daysuntil.app`;
}

export function formatICSDate(dateStr) {
  return dateStr.replace(/-/g, '');
}

function formatICSDateTimeLocal(dateStr, timeStr) {
  const d = formatICSDate(dateStr);
  const t = timeStr.replace(':', '') + '00';
  return `${d}T${t}`;
}

export function buildDTSTART(dateStr, timeStr, timezone) {
  if (!timeStr) return `DTSTART;VALUE=DATE:${formatICSDate(dateStr)}`;
  if (timezone) return `DTSTART;TZID=${timezone}:${formatICSDateTimeLocal(dateStr, timeStr)}`;
  return `DTSTART:${formatICSDateTimeLocal(dateStr, timeStr)}`;
}

export function buildRRULE(recurrence, recurrenceEndDate, recurrenceCount) {
  if (!recurrence) return null;
  const freq = { weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[recurrence];
  if (!freq) return null;
  let rule = `RRULE:FREQ=${freq}`;
  if (recurrenceEndDate) rule += `;UNTIL=${formatICSDate(recurrenceEndDate)}T000000Z`;
  else if (recurrenceCount) rule += `;COUNT=${recurrenceCount}`;
  return rule;
}

function buildDTSTAMP() {
  return 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function buildVEVENT(event, uid) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${generateUID(event.id ?? event.name, uid)}`,
    buildDTSTAMP(),
    buildDTSTART(event.date, event.time || '', event.timezone || ''),
  ];
  if (!event.time) {
    const [y, m, d] = event.date.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    lines.push(`DTEND;VALUE=DATE:${next.getFullYear()}${String(next.getMonth()+1).padStart(2,'0')}${String(next.getDate()).padStart(2,'0')}`);
  }
  lines.push(`SUMMARY:${escapeICS(event.name)}`);
  if (event.notes) lines.push(`DESCRIPTION:${escapeICS(event.notes)}`);
  const rrule = buildRRULE(event.recurrence, event.recurrenceEndDate, event.recurrenceCount);
  if (rrule) lines.push(rrule);
  lines.push('END:VEVENT');
  return lines.map(foldLine).join('\r\n');
}

function wrapVCALENDAR(vevents) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Days Until//Days Until App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Days Until',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '-');
}

export function exportSingleEvent(event, uid) {
  const content = wrapVCALENDAR([buildVEVENT(event, uid)]);
  triggerDownload(content, `${sanitizeFilename(event.name)}.ics`);
}

export function exportAllEvents(events, uid, showToast) {
  if (!events.length) { showToast?.('No events to export.'); return; }
  const content = wrapVCALENDAR(events.map(e => buildVEVENT(e, uid)));
  triggerDownload(content, 'days-until-events.ics');
}
