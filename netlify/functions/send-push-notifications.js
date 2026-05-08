const { schedule } = require('@netlify/functions');
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const COUNT_UP_MILESTONES = [30, 60, 90, 180, 365, 500, 730, 1000];

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [y,m,d] = dateStr.split('-').map(Number);
  return Math.round((new Date(y,m-1,d) - today) / 86400000);
}

function getNextOccurrence(anchorStr, recurrence) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [y,m,d] = anchorStr.split('-').map(Number);
  let date = new Date(y,m-1,d);
  while (date < today) {
    if (recurrence === 'weekly') date.setDate(date.getDate()+7);
    else if (recurrence === 'monthly') date.setMonth(date.getMonth()+1);
    else if (recurrence === 'yearly') date.setFullYear(date.getFullYear()+1);
    else break;
  }
  return date.toISOString().slice(0,10);
}

async function sendToUser(uid, userData) {
  if (!userData.notificationsEnabled) return;
  const leadDays = userData.notificationLeadDays ?? [7,1,0];

  const [subsSnap, eventsSnap] = await Promise.all([
    db.collection(`users/${uid}/pushSubscriptions`).get(),
    db.collection(`users/${uid}/events`).get(),
  ]);
  if (subsSnap.empty) return;

  const subscriptions = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().slice(0,10);

  for (const event of events) {
    if (event.isCountUp) {
      const daysSince = -daysUntil(event.date);
      for (const milestone of COUNT_UP_MILESTONES) {
        if (daysSince !== milestone) continue;
        const logId = `${event.id}_m${milestone}_${todayStr}`;
        const logRef = db.doc(`users/${uid}/notificationLog/${logId}`);
        if ((await logRef.get()).exists) continue;
        await dispatchPush(subscriptions, uid, {
          title: event.name,
          body: `${milestone} days since!`,
          tag: `milestone-${event.id}-${milestone}`,
        }, logRef, event.id, -milestone, todayStr);
      }
      continue;
    }

    const effectiveDate = event.recurrence ? getNextOccurrence(event.date, event.recurrence) : event.date;
    const dl = daysUntil(effectiveDate);

    for (const lead of leadDays) {
      if (dl !== lead) continue;
      const logId = `${event.id}_l${lead}_${todayStr}`;
      const logRef = db.doc(`users/${uid}/notificationLog/${logId}`);
      if ((await logRef.get()).exists) continue;
      const body = lead === 0 ? 'Today!' : `In ${lead} day${lead !== 1 ? 's' : ''}`;
      await dispatchPush(subscriptions, uid, {
        title: event.name,
        body,
        tag: `lead-${event.id}-${lead}`,
      }, logRef, event.id, lead, todayStr);
    }
  }
}

async function dispatchPush(subscriptions, uid, payload, logRef, eventId, leadDays, todayStr) {
  const deadIds = [];
  await Promise.allSettled(subscriptions.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) deadIds.push(sub.id);
    }
  }));
  for (const id of deadIds) {
    await db.doc(`users/${uid}/pushSubscriptions/${id}`).delete();
  }
  await logRef.set({ eventId, leadDays, sentAt: new Date().toISOString().slice(0,10) });
}

module.exports.handler = schedule('0 9 * * *', async () => {
  const usersSnap = await db.collection('users').where('notificationsEnabled', '==', true).get();
  await Promise.allSettled(usersSnap.docs.map(d => sendToUser(d.id, d.data())));
  return { statusCode: 200 };
});
