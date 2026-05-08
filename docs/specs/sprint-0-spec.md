# Sprint 0 Technical Spec — Days Until App

**Date:** 2026-05-07  
**Stack:** React 18, Vite, Tailwind CSS 3, Firebase Auth + Firestore, Netlify Functions, Groq SDK (llama-3.3-70b), chrono-node, PWA (custom SW at `public/sw.js`)  
**Current Firestore path:** `/users/{uid}/events/{eventId}`  
**Current event fields:** `name`, `date` (YYYY-MM-DD), `time` (HH:MM | ""), `color` (Tailwind token e.g. `"yellow-300"`), `recurrence` (`"weekly"|"monthly"|"yearly"|null`), `notes`, `createdAt` (Timestamp)  
**User settings doc:** `/users/{uid}` — currently stores `quickAddMode`, `autoDeleteMode`, `showDayOfWeekMode`

---

## Item 1: Push Notifications (Web Push API + VAPID)

### 1.1 Summary

Users opt in to browser push notifications. Notifications fire at configurable lead times before an event (default: 7 days before, 1 day before, day-of). A Netlify scheduled function evaluates all users' upcoming events daily and dispatches pushes via the Web Push protocol. The Firestore data model is designed so FCM token storage can be added later (mobile) without schema changes.

### 1.2 Firestore Schema Additions

#### `/users/{uid}` (settings doc) — new fields:
```
notificationsEnabled: boolean          // whether user has opted in
notificationLeadDays: number[]         // e.g. [7, 1, 0] — days before event to notify
```
Default: `notificationsEnabled: false`, `notificationLeadDays: [7, 1, 0]`

#### `/users/{uid}/pushSubscriptions/{subscriptionId}` — new subcollection:
```
endpoint: string                       // PushSubscription.endpoint URL
keys: {
  p256dh: string,                      // PushSubscription.keys.p256dh (base64url)
  auth: string                         // PushSubscription.keys.auth (base64url)
}
userAgent: string                      // navigator.userAgent (for debugging, trimmed to 200 chars)
createdAt: Timestamp
// FCM-ready extension fields (leave null for now):
fcmToken: string | null                // placeholder for future Firebase Cloud Messaging token
platform: "web" | "ios" | "android"   // always "web" for now
```
`subscriptionId` = hash of `endpoint` (use first 16 chars of SHA-256, computed client-side).

#### `/users/{uid}/notificationLog/{logId}` — new subcollection:
```
eventId: string
eventDate: string                      // YYYY-MM-DD
leadDays: number                       // which lead-day triggered this (7, 1, or 0)
sentAt: Timestamp
subscriptionEndpoint: string           // truncated to 100 chars for dedup lookup
```
Purpose: dedup guard. Before sending, check if a log entry exists for `(eventId, leadDays, sentAt within current calendar day)`.

### 1.3 Files to Create or Modify

**`public/sw.js`** — add push event handler:
```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Days Until', {
      body: data.body ?? '',
      icon: '/images/icons/icon-192x192.png',
      badge: '/images/icons/icon-72x72.png',
      data: { url: data.url ?? '/' },
      tag: data.tag ?? 'daysuntil-push',        // tag deduplicates visible notifications
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

**`src/hooks/usePushNotifications.js`** — new file:
- `requestPermission()` — calls `Notification.requestPermission()`, subscribes via `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`, writes subscription doc to Firestore.
- `unsubscribe()` — calls `subscription.unsubscribe()`, deletes subscription doc.
- Returns `{ isSupported, isEnabled, requestPermission, unsubscribe }`.
- `VAPID_PUBLIC_KEY` sourced from `import.meta.env.VITE_VAPID_PUBLIC_KEY`.

**`src/components/NotificationSettings.jsx`** — new file:
- Toggle to enable/disable notifications.
- Multi-select checkboxes: "7 days before", "1 day before", "Day of".
- Renders inside the existing settings modal/panel (see `src/components/SettingsModal.jsx` or equivalent — check actual filename).
- On toggle-on: calls `requestPermission()`. On toggle-off: calls `unsubscribe()` and sets `notificationsEnabled: false` in Firestore.

**`src/hooks/useSettings.js`** (`src/hooks/useSettings.js`) — add `notificationsEnabled` and `notificationLeadDays` to `DEFAULT_SETTINGS`:
```js
const DEFAULT_SETTINGS = {
  quickAddMode: false,
  autoDeleteMode: false,
  showDayOfWeekMode: false,
  notificationsEnabled: false,
  notificationLeadDays: [7, 1, 0],
};
```

**`netlify/functions/send-push-notifications.js`** — new Netlify scheduled function:
- Trigger: daily cron (see §1.5 below).
- Uses `web-push` npm package (add to `netlify/functions/package.json`).
- Algorithm:
  1. Read all user docs from `/users` collection where `notificationsEnabled == true`.
  2. For each user, read their `/pushSubscriptions` subcollection and `/events` subcollection.
  3. For each event, for each `leadDay` in `notificationLeadDays`:
     - Compute target date = `effectiveEventDate - leadDay days`.
     - If today == target date:
       - Check `/notificationLog` for existing entry with matching `eventId + leadDays + sentAt >= today midnight`.
       - If no log entry: send push to all subscription endpoints, write log entry.
  4. Dead endpoint handling: if `web-push` throws `410 Gone` or `404`, delete the subscription doc.
- Environment vars needed: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:admin@example.com`).

**`netlify.toml`** — add scheduled function config:
```toml
[functions."send-push-notifications"]
  schedule = "0 9 * * *"   # 09:00 UTC daily
```

**`.env`** / Netlify environment:
```
VITE_VAPID_PUBLIC_KEY=<base64url public key>
VAPID_PRIVATE_KEY=<base64url private key>
VAPID_SUBJECT=mailto:admin@daysuntil.app
```
Generate keys once with `npx web-push generate-vapid-keys`.

### 1.4 Netlify Function Changes

- Add `netlify/functions/send-push-notifications.js` (new, scheduled).
- Add `web-push` to `netlify/functions/package.json` dependencies.
- The function uses the Firebase Admin SDK to read Firestore server-side — add `firebase-admin` to `netlify/functions/package.json`. Initialize with `FIREBASE_SERVICE_ACCOUNT_JSON` env var (base64-encoded service account JSON stored in Netlify env, never committed).

### 1.5 Migration Strategy

No migration needed for existing event data. Existing users simply don't have `notificationsEnabled` in their settings doc — the client defaults to `false` and the scheduled function skips users where `notificationsEnabled != true`.

### 1.6 Edge Cases and Gotchas

- **Permission already granted/denied:** `Notification.permission` may already be `"granted"` or `"denied"` before the user interacts with the toggle. Check `Notification.permission` on mount in `usePushNotifications` and reflect the correct initial state. If `"denied"`, show a message directing user to browser settings — you cannot re-request programmatically.
- **Multiple browser sessions:** One user can have multiple subscriptions (work laptop, home desktop). The scheduled function sends to all of them — this is correct behavior. Each has its own doc in `/pushSubscriptions`.
- **Subscription expiry:** Push endpoints expire. Always handle `410` and `404` responses from `web-push.sendNotification()` by deleting the subscription doc.
- **Recurring events:** `getEffectiveDate()` (in `src/utils/dates.js`) returns the next occurrence date. Use it when computing notification target dates, not `event.date`.
- **Count-up mode (Item 5):** count-up events have milestone notifications (30, 60, 90, 180, 365, 500, 730, 1000 days). The scheduled function must check `isCountUp` and handle milestone logic separately (see Item 5 spec).
- **Safari:** Safari supports Web Push on macOS 13+ and iOS 16.4+ (installed PWA only). `pushManager.subscribe()` will throw on older Safari — guard with `'PushManager' in window`.
- **Netlify scheduled functions** require `@netlify/functions` v1.4+ and the function export must use `schedule` helper. Confirm `netlify/functions/package.json` has correct version.
- **Clock drift:** The function runs at 09:00 UTC. Events with `time` set may be in user's local time — for notification purposes, compare calendar dates only (not timestamps), so "day-of" means the same calendar date as the event in UTC. Timezone-correct date comparison is deferred to Item 2's timezone infrastructure.

### 1.7 Acceptance Criteria

1. On a supported browser, clicking "Enable notifications" shows the browser permission prompt.
2. After granting, a document appears in `/users/{uid}/pushSubscriptions/`.
3. When `notificationsEnabled: true` and `notificationLeadDays: [0]` and an event's date is today, manually triggering the Netlify function results in a push notification appearing in the OS notification center.
4. A log entry is written to `/users/{uid}/notificationLog/` after send.
5. Triggering the function again on the same day for the same event does NOT produce a second notification (dedup check works).
6. Disabling notifications removes the subscription doc from Firestore.
7. `VAPID_PRIVATE_KEY` is never present in any client-side bundle (verify with `npm run build && grep -r "VAPID_PRIVATE" dist/`).

---

## Item 2: Timezone-Aware Events

### 2.1 Summary

Events with a `time` field are timezone-specific — "meeting at 3pm" means different UTC moments depending on where the user is. Date-only events are "floating" and have no timezone. This item: (a) detects the user's IANA timezone, (b) stores it with each event that has a time, (c) displays timed events correctly regardless of where the user's browser is. Date-only events are unaffected.

### 2.2 Firestore Schema Additions

#### `/users/{uid}/events/{eventId}` — new optional field:
```
timezone: string | null    // IANA timezone string e.g. "America/Los_Angeles"
                           // null or absent = floating date (no timezone context)
                           // only meaningful when time != ""
```

#### `/users/{uid}` (settings doc) — new field:
```
defaultTimezone: string    // IANA timezone, detected on first login, user-editable
                           // e.g. "America/New_York"
```

### 2.3 Files to Create or Modify

**`src/utils/dates.js`** — add two functions:

```js
// Returns the user's IANA timezone string
export function detectTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Format a datetime for display in a given timezone.
// dateStr: YYYY-MM-DD, timeStr: HH:MM, tz: IANA string
// Returns e.g. "3:00 PM" in local display format
export function formatTimeInZone(dateStr, timeStr, tz) {
  const [h, m] = timeStr.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  // Construct an absolute moment in the event's timezone
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  // Use Date.UTC trick: build local date, adjust for tz offset
  // Simplest correct approach: use a full ISO string with tz offset via Temporal polyfill
  // or construct via formatter. For now, use the display-only approach:
  const iso = `${dateStr}T${timeStr}:00`;
  const d_ = new Date(iso);  // interpreted as LOCAL time — correct for display-only
  return dtf.format(d_);
}
```

Note: `formatTimeInZone` above works for display when the browser's current timezone equals the stored timezone. For cross-timezone display (user travels), the full implementation requires constructing the date as if it were in the event's stored timezone — use `Intl.DateTimeFormat` with `timeZoneName` option or the `Temporal` API (behind a flag; prefer a minimal manual offset calculation or the `@js-temporal/polyfill` package for correctness).

**`src/hooks/useSettings.js`** — on first load, if `defaultTimezone` is absent from user's settings doc, detect and write it:
```js
if (!snap.data()?.defaultTimezone) {
  const tz = detectTimezone();
  await setDoc(doc(db, 'users', uid), { defaultTimezone: tz }, { merge: true });
}
```

**`src/components/AddEventForm.jsx`** — when saving an event that has a `time` value, include the timezone:
```js
timezone: time ? (settings.defaultTimezone ?? detectTimezone()) : null,
```
This means `saveEvent()` must accept and pass `timezone`. Update the `saveEvent` call signature accordingly.

**`src/components/EventItem.jsx`** — when displaying `event.time`:
- If `event.timezone` is set and differs from the user's current `Intl.DateTimeFormat().resolvedOptions().timeZone`, display the stored timezone abbreviation alongside the time (e.g. "3:00 PM PST").
- If timezones match, display as before.
- Time display helper: extract into `src/utils/dates.js` as `formatTimeDisplay(event, userTimezone)`.

**`src/components/SettingsModal.jsx`** (or equivalent settings component) — add a "Default timezone" selector:
- Display current `defaultTimezone`.
- Allow user to change it via a `<select>` or text input (IANA string).
- On change, update `settings.defaultTimezone` via `updateSettings()`.

### 2.4 Netlify Function Changes

None required for this item. The Groq quick-add function at `netlify/functions/groq.js` already receives `today` as a date string — no timezone handling needed there.

### 2.5 Migration Strategy

Existing events have no `timezone` field. Treat `timezone: null` or absent as floating (current behavior). No write migration needed — the display logic simply falls back to the existing behavior when `timezone` is absent. When a user first loads the app after this change, their `defaultTimezone` will be written to their settings doc.

Future: if an engineer wants to backfill `timezone` on existing timed events, they can write a one-time script that reads all events where `time != ""` and writes `timezone: user.defaultTimezone`. This is optional and out of scope for Sprint 0.

### 2.6 Edge Cases and Gotchas

- **Date-only events are floating:** An event with `time: ""` must never have timezone applied. The displayed date "June 15" means June 15 everywhere — do not convert it.
- **User travels:** When the user's current browser timezone differs from `event.timezone`, the time is still stored in the event's original timezone. Display should show the original time with a timezone label, not convert to local time. Conversion to local time is confusing for events like "Birthday" that the user entered as "9am Pacific" when they were in California.
- **`defaultTimezone` vs `event.timezone`:** These can diverge if the user changes their default timezone after events were created. Event-level `timezone` is authoritative for display.
- **Groq quick-add:** The LLM resolves plain-language dates and times. The resulting event should inherit `settings.defaultTimezone` if a time is present. `netlify/functions/groq.js` already returns `{ name, date, time, ... }` — the client applies `timezone` after receiving the response, before calling `saveEvent`.
- **`Intl.DateTimeFormat` IANA support:** All modern browsers support it. No polyfill needed for the detection step.
- **DST changes:** Using IANA timezone strings (not UTC offsets) means DST is handled automatically by the JS engine.

### 2.7 Acceptance Criteria

1. A new user's `/users/{uid}` doc has a `defaultTimezone` field written on first load (verify in Firestore console).
2. Adding an event with a time stores `timezone: "America/Los_Angeles"` (or whatever the test browser reports) in the event doc.
3. Adding an event without a time stores `timezone: null`.
4. Existing events (no `timezone` field) display identically to before — no visual regression.
5. An event whose stored `timezone` differs from the browser's current timezone shows the timezone label on the time display.
6. The settings panel shows a readable current timezone and allows editing it.

---

## Item 3: ICS Export (Client-Side)

### 3.1 Summary

Users can export a single event or all events as a `.ics` file, downloadable directly from the browser. No Netlify function is needed — generation is pure client-side. Exported files comply with RFC 5545. Recurring events emit `RRULE` lines. Events with times emit `DTSTART` with time; date-only events emit `DTSTART;VALUE=DATE`.

### 3.2 Firestore Schema Additions

None. This item reads existing event data only.

### 3.3 Files to Create or Modify

**`src/utils/icsExport.js`** — new file. Full spec:

```
generateUID(eventId, uid) → string
  Returns a globally unique UID per RFC 5545: `${eventId}-${uid}@daysuntil.app`

formatICSDate(dateStr) → string
  Input: YYYY-MM-DD. Output: YYYYMMDD (for VALUE=DATE events)

formatICSDateTime(dateStr, timeStr, timezone) → { dtstart: string, tzid: string | null }
  If timeStr is empty: return { dtstart: `DTSTART;VALUE=DATE:${formatICSDate(dateStr)}`, tzid: null }
  If timeStr is set and timezone is set:
    return { dtstart: `DTSTART;TZID=${timezone}:${formatICSDateTimeLocal(dateStr, timeStr)}`, tzid: timezone }
  If timeStr is set and timezone is absent/null:
    Treat as floating time: `DTSTART:${formatICSDateTimeLocal(dateStr, timeStr)}`
    (no TZID, no Z suffix = floating per RFC 5545)

formatICSDateTimeLocal(dateStr, timeStr) → string
  Converts YYYY-MM-DD + HH:MM to YYYYMMDDTHHmmss (local, no Z)

buildRRULE(recurrence, recurrenceEndDate, recurrenceCount) → string | null
  recurrence "weekly"  → RRULE:FREQ=WEEKLY
  recurrence "monthly" → RRULE:FREQ=MONTHLY
  recurrence "yearly"  → RRULE:FREQ=YEARLY
  If recurrenceEndDate: append ;UNTIL=<YYYYMMDD>T000000Z
  Else if recurrenceCount: append ;COUNT=<n>
  If no recurrence: return null

foldLine(line) → string
  RFC 5545 line folding: split at 75 octets, continuation lines start with single space.

buildVEVENT(event, uid) → string
  Assembles all VEVENT lines for one event object.
  Required lines: BEGIN:VEVENT, UID, DTSTAMP (now, UTC), DTSTART, SUMMARY, END:VEVENT
  Optional lines: DTEND (= DTSTART + 1 day for date-only; DTSTART + 1 hour for timed),
    DESCRIPTION (from event.notes), RRULE (from buildRRULE), LOCATION (omit, not in schema)

exportSingleEvent(event, uid) → void
  Wraps buildVEVENT in VCALENDAR boilerplate, triggers browser download as `<event.name>.ics`

exportAllEvents(events, uid) → void
  Wraps all buildVEVENT results in one VCALENDAR, triggers download as `days-until-events.ics`
```

VCALENDAR boilerplate:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Days Until//Days Until App//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Days Until
... VEVENTs ...
END:VCALENDAR
```

Browser download helper:
```js
function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**`src/components/EventItem.jsx`** — add export button:
- Add a small "Export" or download icon button to the event card action area (alongside delete/color picker).
- On click: call `exportSingleEvent(event, uid)`.

**`src/components/EventList.jsx`** — add bulk export button:
- In the toolbar row (alongside the existing Search input and Sort select), add an "Export all" button.
- On click: call `exportAllEvents(events, uid)` (pass the full unfiltered `events` array, not the filtered/sorted view).

### 3.4 Netlify Function Changes

None.

### 3.5 Migration Strategy

None. Reads existing data as-is. Events lacking `recurrenceEndDate`/`recurrenceCount` (new fields from Item 6) produce open-ended RRULEs — correct per RFC 5545.

### 3.6 Edge Cases and Gotchas

- **Line folding:** RFC 5545 requires lines > 75 octets be folded with CRLF + space. Long `SUMMARY` or `DESCRIPTION` values will violate this without `foldLine()`. Implement it — Google Calendar rejects malformed ICS silently.
- **CRLF:** ICS files must use CRLF (`\r\n`) line endings. Use `\r\n` as the line separator throughout `icsExport.js`.
- **DTSTAMP:** Must be present on every VEVENT, in UTC format: `YYYYMMDDTHHmmssZ`. Use `new Date().toISOString()` and strip the dashes/colons.
- **Recurring events and `DTEND`:** For recurring date-only events, omit `DTEND` and use `DURATION:P1D` instead — this is more portable across calendar apps.
- **`event.color` in ICS:** No standard property. Omit — some clients support `COLOR:` extension but it's non-standard.
- **Special characters in SUMMARY/DESCRIPTION:** Escape commas, semicolons, and backslashes per RFC 5545 (`\,`, `\;`, `\\`). Newlines in notes → `\n` (literal backslash-n within the property value).
- **Filename sanitization:** `event.name` may contain characters invalid in filenames (slashes, colons). Sanitize: `event.name.replace(/[\\/:*?"<>|]/g, '-')` before using as filename.
- **`exportAllEvents` with empty list:** Guard — if `events.length === 0`, show a toast instead of producing an empty VCALENDAR.

### 3.7 Acceptance Criteria

1. Clicking the export button on a single event downloads a `.ics` file.
2. Opening the file in Apple Calendar or Google Calendar import creates the event correctly (name, date, time if present).
3. A recurring event's `.ics` contains a valid `RRULE` line.
4. A timed event's `.ics` contains `DTSTART;TZID=...` (or floating, if no timezone stored).
5. A date-only event's `.ics` contains `DTSTART;VALUE=DATE:YYYYMMDD`.
6. "Export all" downloads a single `.ics` with one VEVENT per event.
7. Running the exported file through an ICS validator (e.g. icalendar.org/validator) produces no errors.

---

## Item 4: Subscribed Calendar Feed (.ics URL per user)

### 4.1 Summary

Each user gets a secret, stable URL they can paste into Google Calendar / Apple Calendar to subscribe. The URL is a Netlify function that reads the user's events from Firestore using the service account (no user auth) and returns a valid `text/calendar` response. The secret token — not the user's UID — authenticates the request.

### 4.2 Firestore Schema Additions

#### `/users/{uid}` (settings doc) — new field:
```
calendarFeedToken: string    // cryptographically random, 32 hex chars (128 bits)
                             // generated on first access, never regenerated (stable URL)
```

#### `/calendarTokens/{token}` — new top-level collection (lookup index):
```
uid: string                  // maps token → uid for server-side lookup
createdAt: Timestamp
```
This collection is needed because the Netlify function receives only the token, not the UID. A reverse lookup in Firestore requires either this index or a collection group query — the index is simpler and O(1).

### 4.3 Files to Create or Modify

**`netlify/functions/calendar-feed.js`** — new file:

```
GET /.netlify/functions/calendar-feed?token=<token>

Algorithm:
1. Read token from query params. 400 if absent.
2. Look up /calendarTokens/{token} → get uid. 403 if not found.
3. Read /users/{uid}/events (all docs, no auth required — service account).
4. Build ICS using the same logic as src/utils/icsExport.js — but this runs server-side,
   so duplicate the buildVEVENT / VCALENDAR assembly in a shared utility, or
   inline it in the function (preferred to avoid bundling client code in functions).
5. Return response:
   Content-Type: text/calendar; charset=utf-8
   Content-Disposition: attachment; filename="days-until.ics"
   Cache-Control: no-cache, no-store    ← Google Calendar polls; no caching
   Body: full ICS text
```

Uses `firebase-admin` (already needed for Item 1). Initialize once at module level with `FIREBASE_SERVICE_ACCOUNT_JSON` env var.

**`src/hooks/useCalendarFeed.js`** — new file:
- On mount, reads `settings.calendarFeedToken`.
- If absent: generate token (`crypto.randomUUID()` or `crypto.getRandomValues` → hex string), write to `/users/{uid}` and `/calendarTokens/{token}`, then set in state.
- Returns `{ feedUrl, isGenerating }` where `feedUrl = https://your-netlify-domain/.netlify/functions/calendar-feed?token=${token}`.

**`src/components/SettingsModal.jsx`** (or settings component) — add Calendar Feed section:
- Show the feed URL in a read-only input with a "Copy" button.
- "Regenerate link" button (with confirmation warning: existing subscriptions will break) — calls a function that generates a new token, writes both the new `/calendarTokens/{newToken}` and deletes the old `/calendarTokens/{oldToken}`, then updates `/users/{uid}/calendarFeedToken`.

### 4.4 Netlify Function Changes

- Add `netlify/functions/calendar-feed.js` (new).
- Add `firebase-admin` to `netlify/functions/package.json` (shared with Item 1).
- The function must be an HTTP function (event-based, not scheduled). Netlify treats any JS file in `netlify/functions/` as an HTTP endpoint automatically.
- Function signature: `export async function handler(event, context) { ... }` using `@netlify/functions` handler format.

### 4.5 Migration Strategy

Existing users have no `calendarFeedToken`. The token is generated lazily on first visit to the settings panel — no migration script needed.

### 4.6 Edge Cases and Gotchas

- **Token entropy:** `crypto.randomUUID()` produces 122 bits of randomness — sufficient. Do not use `Math.random()`.
- **Token in URL is a secret:** Warn users in the UI that sharing the URL gives read access to all their events. The settings section should display this caveat.
- **CORS:** The calendar feed endpoint will be polled by Google/Apple servers, not the user's browser. No CORS headers needed — the request is server-to-server.
- **Google Calendar polling interval:** Google Calendar polls subscribed ICS URLs roughly every 24 hours (can be faster for paid accounts). The `Cache-Control: no-cache` header is advisory. Events added in Firestore will appear in Google Calendar within ~24 hours.
- **Netlify function cold start:** Firestore reads may take 500-1500ms on cold start. This is acceptable — the polling client has generous timeouts.
- **`/calendarTokens` security rules:** Firestore security rules must deny client-side reads/writes to `/calendarTokens/*` — the collection is only accessed server-side. Add to `firestore.rules`:
  ```
  match /calendarTokens/{token} {
    allow read, write: if false;
  }
  ```
- **Token regeneration:** When the user regenerates their link, the old `/calendarTokens/{oldToken}` doc must be deleted — otherwise the old URL continues to work. The client must read the current token before generating the new one to know which old doc to delete.
- **Large event lists:** Netlify functions have a 10-second timeout on Netlify's free tier. Reading hundreds of events and generating ICS should be well under 1 second. No concern unless user has 1000+ events.

### 4.7 Acceptance Criteria

1. Opening settings shows a calendar feed URL with a "Copy" button.
2. Pasting the URL into a browser returns `text/calendar` content with correct VEVENT entries.
3. Pasting the URL into Google Calendar (Settings → Add calendar → From URL) successfully subscribes.
4. A request with an invalid/missing token returns HTTP 403.
5. After "Regenerate link", the old URL returns 403 and the new URL returns 200.
6. `FIREBASE_SERVICE_ACCOUNT_JSON` is never present in `dist/` (verify with `grep -r "private_key" dist/`).
7. `/calendarTokens` collection cannot be read from a browser (verify Firestore security rules reject the read).

---

## Item 5: Count-Up Mode (Days Since)

### 5.1 Summary

Per-event toggle: instead of counting down to a future date, count up from a past date. Display changes from "in X days" to "X days since". Milestone push notifications fire at 30, 60, 90, 180, 365, 500, 730, and 1000 days. Count-up events appear in the "Past" section of `EventList`.

### 5.2 Firestore Schema Additions

#### `/users/{uid}/events/{eventId}` — new field:
```
isCountUp: boolean    // default: false (absent = false)
```

### 5.3 Files to Create or Modify

**`src/utils/dates.js`** — add:
```js
// Returns days elapsed since dateStr (positive number if dateStr is in the past)
export function calculateDaysSince(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const eventDate = new Date(y, m - 1, d);
  return Math.floor((today - eventDate) / (1000 * 60 * 60 * 24));
}

// Milestones for count-up notifications
export const COUNT_UP_MILESTONES = [30, 60, 90, 180, 365, 500, 730, 1000];
```

**`src/components/EventItem.jsx`** — count-up display logic:
- If `event.isCountUp === true`:
  - Primary number: `calculateDaysSince(event.date)` (always positive or 0).
  - Label: `"days since"` instead of `"days until"` / `"Today"` / `"X ago"`.
  - If `daysSince === 0`: show `"Today"`.
  - If `daysSince < 0` (event date in future): show `"starts in X days"` — count-up events can have future dates (user tracking a future anniversary).
  - Visual treatment: same card layout, but the color accent can be optionally inverted (design call — leave as-is for now, same color tokens).

**`src/components/EventList.jsx`** — sort/section logic:
- Count-up events with `daysSince >= 0` appear in the **Upcoming** section (they are ongoing, not "past").
- Count-up events with `daysSince < 0` (future start date) also appear in Upcoming.
- Sort: within Upcoming, count-up events sort after countdown events by default (soonest-first sort should treat count-up events as `daysLeft = -daysSince` so they appear after imminent countdown events). Alternatively: a dedicated "Count-up" sub-section. For Sprint 0, simpler is better — keep them in Upcoming but sort them last (treat as `Infinity` days away from "upcoming" perspective, or insert after all countdown events).

**`src/components/AddEventForm.jsx`** — add toggle:
- Checkbox or toggle: "Count up (days since)".
- When checked: label the date field "Since when?" instead of "Date".
- The `time` field is still available (for precise anniversary tracking).
- Pass `isCountUp` to `saveEvent`.

**`src/components/EventItem.jsx`** — add inline toggle:
- In the event card's edit/action area, add a small toggle to flip `isCountUp` on an existing event. On toggle: `updateDoc(eventRef, { isCountUp: !event.isCountUp })`.

**`netlify/functions/send-push-notifications.js`** (from Item 1) — milestone notification logic:
```
For each count-up event (isCountUp === true):
  daysSince = today - event.date (in days)
  for each milestone in COUNT_UP_MILESTONES:
    if daysSince === milestone:
      check notificationLog for (eventId, leadDays: -milestone, sentAt: today)
      if no entry: send push with title "{event.name}" body "{milestone} days since!"
                   write log entry with leadDays: -milestone (negative = milestone)
```
Using negative `leadDays` in the log entry namespaces milestone notifications away from lead-day notifications cleanly.

### 5.4 Netlify Function Changes

The `send-push-notifications.js` function (Item 1) is extended — no new function.

### 5.5 Migration Strategy

`isCountUp` absent = `false`. No migration needed. Existing events behave identically.

### 5.6 Edge Cases and Gotchas

- **Count-up with recurrence:** Recurrence + count-up is a contradictory combination (you can't count up since a recurring event). In the UI, disable the recurrence field when `isCountUp` is checked. In the data model, if both `isCountUp: true` and `recurrence` are set, `isCountUp` takes precedence for display. The Groq quick-add LLM may hallucinate both — add a post-processing check: if `isCountUp`, set `recurrence: null`.
- **Future date + isCountUp:** Valid use case — "I'm quitting smoking on June 1, 2026 — count up from then." Show "starts in X days" until the date arrives, then show "X days since".
- **`autoDeleteMode`:** The existing `autoDeleteMode` in `EventList.jsx` deletes events where `calculateDaysLeft(event.date) < 0 && !event.recurrence`. Must add `&& !event.isCountUp` to this guard — count-up events should never be auto-deleted.
- **ICS export (Item 3):** A count-up event exported to ICS should export the anchor date as `DTSTART` with no `RRULE` (it's a one-time past event, not recurring). Add a comment in `buildVEVENT` noting this.
- **Display when daysSince is very large:** "1847 days since" is a large number — the card layout accommodates it since it's just a number. No truncation needed.

### 5.7 Acceptance Criteria

1. Adding a count-up event with a past date shows "X days since" where X is the correct number of days.
2. Adding a count-up event with today's date shows "Today".
3. Adding a count-up event with a future date shows "starts in X days".
4. Toggling an existing event to count-up mode immediately updates the display (Firestore write + `onSnapshot` re-render).
5. Count-up events are NOT deleted by `autoDeleteMode`.
6. Exactly at 365 days (set the date to today - 365 in Firestore), triggering the push function sends a milestone notification and writes a log entry.
7. Count-up events appear in the Upcoming section, not Past.

---

## Item 6: Recurrence End Date / Count

### 6.1 Summary

Recurring events currently repeat forever. This item adds two optional stop conditions: `recurrenceEndDate` (stop after a specific date) and `recurrenceCount` (stop after N occurrences). Only one of the two can be set at a time. The UI shows an end-date picker and a count input when a recurrence type is selected. `getNextOccurrence` in `src/utils/dates.js` is updated to respect these limits. ICS export emits `UNTIL=` or `COUNT=` in the RRULE.

### 6.2 Firestore Schema Additions

#### `/users/{uid}/events/{eventId}` — new optional fields:
```
recurrenceEndDate: string | null    // YYYY-MM-DD — stop on/after this date
recurrenceCount: number | null      // stop after N total occurrences (counting from event.date)
```
Constraint: at most one of the two is non-null. If both arrive (shouldn't happen), `recurrenceEndDate` takes precedence.

### 6.3 Files to Create or Modify

**`src/utils/dates.js`** — modify `getNextOccurrence(anchorDateStr, recurrence)` signature to:
```js
export function getNextOccurrence(anchorDateStr, recurrence, { endDate = null, count = null } = {})
```

End-date logic: after computing the candidate next occurrence, if `endDate` is set and the candidate is after `endDate`, return `null` (no next occurrence). Callers must handle `null`.

Count logic: count the number of occurrences from `anchorDateStr` to today. If `occurrencesSoFar >= count`, return `null`.

**`getEffectiveDate(event)`** — already calls `getNextOccurrence`. Update it to:
- Pass `{ endDate: event.recurrenceEndDate ?? null, count: event.recurrenceCount ?? null }`.
- If `getNextOccurrence` returns `null`: return `event.recurrenceEndDate ?? event.date` (the last known occurrence date, which is in the past — the event will appear in the Past section and eventually be hidden/cleaned up by `autoDeleteMode` if enabled).

**`src/components/AddEventForm.jsx`** — add end condition UI:
- When `recurrence` is set (non-empty), show an additional row:
  ```
  [ ] End date: [date input]
  [ ] After: [number input] occurrences
  ```
  Implement as radio-style selection (neither, end date, or count). Default: neither.
- State: `recurrenceEndMode: "none" | "date" | "count"`, `recurrenceEndDate: ""`, `recurrenceCount: ""`.
- Include in `saveEvent` payload: `recurrenceEndDate: recurrenceEndMode === "date" ? recurrenceEndDate : null`, `recurrenceCount: recurrenceEndMode === "count" ? parseInt(recurrenceCount) : null`.
- Validate: if end-date mode and `recurrenceEndDate <= event.date`, show toast error.
- Validate: if count mode and `recurrenceCount < 1`, show toast error.

**`src/components/EventItem.jsx`** — inline editing:
- `recurrenceEndDate` and `recurrenceCount` should be editable in the same inline-edit pattern as other fields. The recurrence label (e.g. "Every Wednesday") can show "until Dec 31" or "3 more times" as a sub-label.
- For Sprint 0, it is acceptable to require the user to delete and re-add an event to change these fields (inline edit is a nice-to-have). Mark this as a known limitation.

**`src/utils/icsExport.js`** (`buildRRULE`) — already specced in Item 3 to accept these fields:
- `recurrenceEndDate` → `UNTIL=<YYYYMMDD>T000000Z` (in UTC, end of that day; use midnight UTC on that date).
- `recurrenceCount` → `COUNT=<n>`.

### 6.4 Netlify Function Changes

None.

### 6.5 Migration Strategy

Existing recurring events have no `recurrenceEndDate` or `recurrenceCount` — both absent = `null` = infinite recurrence. No behavioral change for existing events.

### 6.6 Edge Cases and Gotchas

- **`getNextOccurrence` returning `null`:** Every caller of `getEffectiveDate` must handle the case where the event is "expired" (past its end). In `EventList.jsx`, the `upcoming`/`past` split uses `calculateDaysLeft(getEffectiveDate(e)) >= 0`. If `getEffectiveDate` returns the `recurrenceEndDate` (a past date), the event will appear in Past. This is correct.
- **`calculateDaysLeft` receives `null`:** If `getEffectiveDate` could ever return `null`, `calculateDaysLeft` would crash. Design decision: `getEffectiveDate` must never return `null` — instead return the last past occurrence date so the event shows as past. Document this invariant clearly in the code.
- **Count calculation for weekly recurrence:** Counting occurrences since `anchorDateStr` for weekly recurrence is `Math.floor((today - anchor) / 7) + 1`. Verify with edge case: if today is the anchor date, count = 1. If user sets `recurrenceCount: 1`, the event fires once (on `anchorDateStr`) and never again.
- **Monthly recurrence count edge case:** Months have variable length. Counting occurrences of "every month on the 31st" from Jan 31 to Mar 31 is 3 occurrences even though Feb 31 doesn't exist (the existing `getNextOccurrence` already skips invalid months — preserve this behavior in count tracking).
- **`autoDeleteMode` with end date:** An expired recurring event (past its `recurrenceEndDate`, no future occurrences) should be treated as a non-recurring past event for `autoDeleteMode` purposes. The guard condition should be updated: `calculateDaysLeft(event.date) < 0 && !event.recurrence` OR `isExpiredRecurrence(event)`. Define `isExpiredRecurrence`: `event.recurrence && getEffectiveDate(event)` resolves to a past date.
- **ICS `UNTIL` format:** Per RFC 5545, when `DTSTART` is a date-only (`VALUE=DATE`), `UNTIL` must also be a date-only (`YYYYMMDD`). When `DTSTART` has a time, `UNTIL` must be a UTC datetime (`YYYYMMDDTHHMMSSZ`). Implement this distinction in `buildRRULE`.
- **Groq quick-add:** The LLM does not produce `recurrenceEndDate` or `recurrenceCount` — these are UI-only fields for Sprint 0.

### 6.7 Acceptance Criteria

1. Adding a weekly event with end date "2026-12-31" stores `recurrenceEndDate: "2026-12-31"` in Firestore.
2. After the end date passes, `getEffectiveDate` returns the last occurrence (in the past), and the event appears in the Past section.
3. Adding a monthly event with count = 3 stores `recurrenceCount: 3`. After 3 occurrences, the event appears in Past.
4. Both fields cannot be set simultaneously — the UI enforces radio-style selection.
5. Exported ICS for a weekly event with end date contains `RRULE:FREQ=WEEKLY;UNTIL=20261231T000000Z`.
6. Exported ICS for a monthly event with count = 3 contains `RRULE:FREQ=MONTHLY;COUNT=3`.
7. Existing recurring events (no end date/count) continue to repeat forever — no regression.

---

## Cross-Cutting Concerns

### Firestore Security Rules

After Sprint 0, the following security rules changes are required:

1. `/calendarTokens/{token}` — deny all client reads/writes (service account only).
2. `/users/{uid}/pushSubscriptions/{subId}` — allow read/write by `request.auth.uid == uid` only.
3. `/users/{uid}/notificationLog/{logId}` — allow read by `request.auth.uid == uid`; write only via service account (the function should write it — block client writes).
4. All existing event rules: unchanged.

### Environment Variables Summary

| Variable | Used in | Purpose |
|---|---|---|
| `VITE_VAPID_PUBLIC_KEY` | Client (Vite) | Web Push subscription |
| `VAPID_PRIVATE_KEY` | Netlify Functions | Sign push messages |
| `VAPID_SUBJECT` | Netlify Functions | VAPID identity |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Netlify Functions | Firebase Admin SDK auth |

All four must be set in Netlify's environment variable dashboard. Only `VITE_VAPID_PUBLIC_KEY` is baked into the client bundle (it's a public key — safe).

### New npm Dependencies

**Client (`package.json` root):**
- None required (all new client code uses existing deps + Web APIs).

**Functions (`netlify/functions/package.json`):**
- `web-push` — Web Push protocol implementation.
- `firebase-admin` — Firestore server-side reads.

### Test Coverage

Each new utility should have a corresponding test file:

| File | Test file |
|---|---|
| `src/utils/icsExport.js` | `src/utils/icsExport.test.js` |
| `src/utils/dates.js` (new functions) | `src/utils/dates.test.js` (extend existing) |

Test runner: Vitest (`npm test`). Minimum cases per function: happy path, null/absent optional fields, edge cases called out in each item's "Gotchas" section.
