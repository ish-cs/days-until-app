const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

function escapeICS(str) {
  return (str ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const parts = [];
  let buf = Buffer.from(line, 'utf8');
  let first = true;
  while (buf.length > 0) {
    const limit = first ? 75 : 74;
    parts.push((first ? '' : ' ') + buf.slice(0, limit).toString('utf8'));
    buf = buf.slice(limit);
    first = false;
  }
  return parts.join('\r\n');
}

function formatDate(str) { return str.replace(/-/g, ''); }
function dtstamp() { return 'DTSTAMP:' + new Date().toISOString().replace(/[-:.]/g, '').slice(0,15) + 'Z'; }

function buildVEVENT(event, uid) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id ?? event.name}-${uid}@daysuntil.app`,
    dtstamp(),
  ];
  if (event.time && event.timezone) {
    const dt = event.date.replace(/-/g,'') + 'T' + event.time.replace(':','') + '00';
    lines.push(`DTSTART;TZID=${event.timezone}:${dt}`);
  } else if (event.time) {
    const dt = event.date.replace(/-/g,'') + 'T' + event.time.replace(':','') + '00';
    lines.push(`DTSTART:${dt}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(event.date)}`);
    const [y,m,d] = event.date.split('-').map(Number);
    const next = new Date(y,m-1,d+1);
    lines.push(`DTEND;VALUE=DATE:${next.getFullYear()}${String(next.getMonth()+1).padStart(2,'0')}${String(next.getDate()).padStart(2,'0')}`);
  }
  lines.push(`SUMMARY:${escapeICS(event.name)}`);
  if (event.notes) lines.push(`DESCRIPTION:${escapeICS(event.notes)}`);
  if (event.recurrence) {
    const freq = { weekly:'WEEKLY', monthly:'MONTHLY', yearly:'YEARLY' }[event.recurrence];
    if (freq) {
      let rule = `RRULE:FREQ=${freq}`;
      if (event.recurrenceEndDate) rule += `;UNTIL=${formatDate(event.recurrenceEndDate)}T000000Z`;
      else if (event.recurrenceCount) rule += `;COUNT=${event.recurrenceCount}`;
      lines.push(rule);
    }
  }
  lines.push('END:VEVENT');
  return lines.map(foldLine).join('\r\n');
}

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token) return { statusCode: 400, body: 'Missing token' };

  const tokenDoc = await db.collection('calendarTokens').doc(token).get();
  if (!tokenDoc.exists) return { statusCode: 403, body: 'Invalid token' };

  const uid = tokenDoc.data().uid;
  const eventsSnap = await db.collection(`users/${uid}/events`).get();
  const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const vevents = events.map(e => buildVEVENT(e, uid)).join('\r\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Days Until//Days Until App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Days Until',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="days-until.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
    body: ics,
  };
};
