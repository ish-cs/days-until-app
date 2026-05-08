# Near-Term Features — Implementation Plan

## Codebase Audit: What's Already Built

| Feature | Status |
|---|---|
| 3. Past/Future Grouping | **DONE** — `EventList.jsx:273-309`, collapsible Past section |
| 4. Sorting Options (UI) | **DONE** — `EventList.jsx:236-245`, 4 sort options; localStorage-persisted |
| 5. Bulk Operations | **DONE** — `EventList.jsx:136-163, 247-260, 312-336`, delete only |
| 7. Time Field Editing | **DONE** — `AddEventForm.jsx:107-111` (form), `EventItem.jsx:224-233` (inline) |
| 8. Event Notes (core) | **DONE** — `AddEventForm.jsx:138-147` (form), `EventItem.jsx:263-314` (card) |
| 9. Search (name only) | **DONE** — name search + color filter chips implemented |
| 1. Quick Add Recurrence Preview | **DONE** — `src/utils/recurrencePreview.js`, `AddEventForm.jsx` |
| 2. ICS Import Warning | **DONE** |
| 6. Timezone Handling | **DONE** |

---

## Current Data Model (Firestore)

Path: `users/{uid}/events/{eventId}`

```
name: string
date: string (YYYY-MM-DD)
time: string (HH:MM 24h, or "")
bgColor: string (tailwind token, e.g. "yellow-300")
owner: string (uid)
recurrence?: "weekly" | "monthly" | "yearly"
notes?: string
```

---

## Feature 1 — Quick Add Recurrence Preview

**Status: DONE.**

Shows a "Repeats: weekly" chip below the quick-add input as the user types — no network call, pure regex.

**Files to modify:**
- `src/components/AddEventForm.jsx`

**State changes:** Add `const [recurrencePreview, setRecurrencePreview] = useState(null)` inside `AddEventForm`.

**Logic (extract to `src/utils/recurrencePreview.js`):**
```js
export function detectRecurrencePreview(text) {
  const t = text.toLowerCase();
  if (/\bevery\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(t) ||
      /\bweekly\b/.test(t) || /\beach\s+\w+day\b/.test(t) ||
      /\bevery other week\b/.test(t)) return 'weekly';
  if (/\bevery\s+month\b/.test(t) || /\bmonthly\b/.test(t) || /\beach month\b/.test(t)) return 'monthly';
  if (/\bevery\s+year\b/.test(t) || /\bannually\b/.test(t) || /\byearly\b/.test(t)) return 'yearly';
  return null;
}
```

**onChange wiring in AddEventForm:**
```jsx
onChange={(e) => {
  setName(e.target.value);
  if (isQuickAdd) setRecurrencePreview(detectRecurrencePreview(e.target.value));
}}
```

**UI (render below composer-main div, only in quick-add mode):**
```jsx
{isQuickAdd && recurrencePreview && (
  <div className="recurrence-preview-chip">
    ↻ Repeats: {recurrencePreview}
  </div>
)}
```

Add `.recurrence-preview-chip` to `src/index.css` — match existing `.recurrence-badge` style (small pill, muted color, 11px font).

Reset `recurrencePreview` to `null` after successful quick-add in `handleQuickAdd`.

**Gotchas:**
- Keep regex conservative. "next Friday" must NOT trigger — it's a one-time phrase.
- Keywords must match exactly what Groq uses (same set already in `groq.js` prompt).
- Clear preview on form reset.

**No data model changes.**

**Complexity: S**

**Tests:** Unit test `detectRecurrencePreview` in `src/utils/recurrencePreview.test.js`.

---

## Feature 2 — ICS Import Warning / Duplicate Detection

**Status: DONE.**

Before committing ICS import, check parsed events against existing events and surface duplicates to the user.

**Files to modify:**
- `src/components/SettingsMenu.jsx`
- `src/utils/icsParser.js` (extract `detectDuplicates` here)

**Extract to `icsParser.js`:**
```js
export function detectDuplicates(incoming, existing) {
  return incoming.filter(ev =>
    existing.some(ex => ex.name === ev.name && ex.date === ev.date)
  );
}
```

**In `SettingsMenu.handleImportIcs`, after parsing:**
```js
const snapshot = await getDocs(collection(db, 'users', uid, 'events'));
const existing = snapshot.docs.map(d => d.data());

const duplicates = detectDuplicates(events, existing);
const fresh = events.filter(ev =>
  !existing.some(ex => ex.name === ev.name && ex.date === ev.date)
);

if (duplicates.length > 0) {
  showConfirm(
    `${fresh.length} new event${fresh.length !== 1 ? 's' : ''} will be added. ` +
    `${duplicates.length} already exist${duplicates.length !== 1 ? '' : 's'} (same name + date).\n\n` +
    `Confirm = import all.  Cancel = skip duplicates.`,
    () => importEvents(events),
    () => importEvents(fresh)
  );
  return;
}
// No duplicates — import all
importEvents(events);
```

**Gotcha:** `showConfirm` is already passed to SettingsMenu as a prop — no plumbing needed.

**Pre-existing bug to fix here:** `icsParser.js` only handles `DTSTART;VALUE=DATE:` (all-day events). Timed events use `DTSTART:20250515T140000Z` (datetime). Most Google/Apple calendar exports use datetime format, causing silent import failures. Fix while in this file:
```js
// Parse both formats
const dateOnlyMatch = line.match(/^DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
const dateTimeMatch = line.match(/^DTSTART(?:;[^:]*)?:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
```

**Complexity: S** (option 1 — simple confirm dialog)

**Tests:** Unit test `detectDuplicates(incoming, existing)` in `src/utils/icsParser.test.js`.

---

## Feature 3 — Past/Future Grouping

**Status: ALREADY IMPLEMENTED.** `EventList.jsx:206-309` splits events into upcoming/past with collapsible Past section.

**No work needed.** CSS tweaks only if visual treatment needs adjustment.

---

## Feature 4 — Sorting Options

**Status: DONE.** localStorage persistence implemented. `applySort` duplication removed — now uses `sortEvents` from `sortFilter.js`. Optional "date added" sort skipped (requires schema change).

**Files to modify:**
- `src/components/EventList.jsx`
- `src/utils/sortFilter.js`
- `src/components/AddEventForm.jsx` (add `createdAt` to save payload)
- `src/components/SettingsMenu.jsx` (add `createdAt` to import payloads)

**Gap 1 — localStorage persistence (3-line change in EventList.jsx):**
```js
// Change:
const [sortOrder, setSortOrder] = useState('soonest');
// To:
const [sortOrder, setSortOrder] = useState(
  () => localStorage.getItem('sortOrder') || 'soonest'
);
// And in onChange:
setSortOrder(e.target.value);
localStorage.setItem('sortOrder', e.target.value);
```

**Gap 2 — Remove `applySort` duplication:** `EventList.jsx:37-49` duplicates `sortEvents` from `sortFilter.js`. Replace with import.

**Gap 3 — "Date added" sort (optional, requires schema change):**
- Add `createdAt: serverTimestamp()` to `saveEvent` in `AddEventForm.jsx` and to import payloads in `SettingsMenu.jsx`.
- Add case to `sortFilter.js:sortEvents`: `case 'dateAdded': return sorted.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));`
- Add option to sort select in `EventList.jsx`.
- Existing events without `createdAt` sort as 0 (bottom). Acceptable.

**Data model change:** Optional `createdAt: Timestamp` field.

**Complexity: S**

---

## Feature 5 — Bulk Operations

**Status: ALREADY IMPLEMENTED (delete only).** `EventList.jsx:136-163, 247-260, 312-336`.

**No work needed for v1.** Future: add color change and tag options to the floating action bar at `EventList.jsx:329`.

---

## Feature 6 — Timezone Handling

**Status: DONE.**

**Files to modify:**
- `src/components/AddEventForm.jsx` — include `timezone` in save payload
- `src/components/EventItem.jsx` — update time display with timezone label
- `src/components/SettingsMenu.jsx` — include `timezone` in import payloads

**Data model change:** Add optional `timezone: string` (IANA, e.g. `"America/New_York"`) to event documents.

**In AddEventForm `saveEvent`:**
```js
const payload = {
  name: eventName,
  date: eventDate,
  time: eventTime,
  bgColor,
  owner: uid,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,  // add
};
```

**Recommended approach for display (v1):** Show timezone abbreviation suffix when stored timezone differs from user's current timezone. No full conversion (avoids complex Intl workarounds).

```js
function getShortTz(ianaTimezone) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: ianaTimezone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value ?? ianaTimezone;
  } catch {
    return ianaTimezone;
  }
}

function formatTime(t, storedTz) {
  if (!t) return '';
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = storedTz && storedTz !== userTz ? ` (${getShortTz(storedTz)})` : '';
  return `${h12}:${m} ${ampm}${suffix}`;
}
```

Non-breaking — old events without `timezone` field show no suffix.

**Complexity: M**

---

## Feature 7 — Time Field Editing

**Status: ALREADY IMPLEMENTED.**
- Form: `AddEventForm.jsx:107-111` — `<input type="time">` in standard mode
- Inline edit: `EventItem.jsx:224-233`
- Clear support: empty string clears the field (`commitEdit` at line 80-82)
- Display: "＋ time" hint when no time set (`EventItem.jsx:243-259`)

**No work needed.**

---

## Feature 8 — Event Notes

**Status: FULLY IMPLEMENTED.**

- [x] `src/components/AddEventForm.jsx` — `maxLength={500}` added to notes textarea
- [x] `src/components/EventItem.jsx` — `maxLength={500}` on edit textarea (done)

**Complexity: XS** (2 attribute additions)

---

## Feature 9 — Search/Filter

**Status: DONE.** Name search + color filter chips implemented. `filterEvents` in `sortFilter.js` updated to accept optional `colorFilter` param.

**Files to modify:**
- `src/components/EventList.jsx`
- `src/utils/sortFilter.js`

**State change in EventList:**
```js
const [colorFilter, setColorFilter] = useState(null);
```

**Update filter logic in EventList (replace inline filter):**
```js
const filtered = events.filter(e => {
  const nameMatch = !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase());
  const colorMatch = !colorFilter || (e.bgColor || 'yellow-300') === colorFilter;
  return nameMatch && colorMatch;
});
```

**Color chip UI (add below search input):**
```jsx
<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
  {COLOR_NAMES.map(colorKey => (
    <button
      key={colorKey}
      type="button"
      title={colorKey}
      style={{
        width: 20, height: 20, borderRadius: '50%',
        background: ACCENT_COLORS[colorKey],
        border: colorFilter === colorKey ? '2px solid var(--ink-1)' : '2px solid transparent',
        cursor: 'pointer', padding: 0,
      }}
      onClick={() => setColorFilter(prev => prev === colorKey ? null : colorKey)}
      aria-pressed={colorFilter === colorKey}
      aria-label={`Filter by ${colorKey}`}
    />
  ))}
  {colorFilter && (
    <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
      onClick={() => setColorFilter(null)}>
      Clear
    </button>
  )}
</div>
```

**Import in EventList:** `import { ACCENT_COLORS, COLOR_NAMES } from '../utils/colors.js';`

**Update `filterEvents` in `sortFilter.js`** to accept color param, then use it in EventList (removes inline duplication):
```js
export function filterEvents(events, search, colorFilter = null) {
  return events.filter(e => {
    const nameMatch = !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase());
    const colorMatch = !colorFilter || (e.bgColor || 'yellow-300') === colorFilter;
    return nameMatch && colorMatch;
  });
}
```

**Complexity: S**

**Tests:** Update `sortFilter.test.js` to cover `filterEvents(events, '', 'red-300')` and combined search+color.

---

## Recommended Build Order

### Phase 1 — Quick wins (no schema changes, minimal risk)
1. **Feature 8** — `maxLength={500}` on 2 textareas. XS.
2. **Feature 4** — localStorage persistence (3-line fix) + remove `applySort` duplication. S.
3. **Feature 9** — color filter chips. S.
4. **Feature 1** — quick add recurrence preview. S.

### Phase 2 — Medium effort, no schema changes
5. **Feature 2** — ICS import warning + fix `DTSTART` datetime parsing bug. S-M.

### Phase 3 — Schema additions (touch all save paths together)
6. **Feature 4** "date added" sort — add `createdAt: serverTimestamp()` across AddEventForm + SettingsMenu imports, add sort case.
7. **Feature 6** — timezone field. Add to all save paths after Phase 2 already has SettingsMenu open.

### Phase 4 — Already done, verify in browser
- Features 3, 5, 7: visual check only.
- Feature 8 core: just add maxLength.

---

## Cross-Cutting Issues Found

**`sortFilter.js:filterEvents`** — updated with `colorFilter` param. `EventList.jsx` uses inline filter (consistent with the pattern); `filterEvents` available for future callers.

**Export drops fields:** `SettingsMenu.handleExport` only exports `name, date, time, bgColor` — silently drops `notes`, `recurrence`, `timezone`. Fix when touching SettingsMenu.

**ICS datetime parsing bug:** `icsParser.js` only handles all-day `DTSTART;VALUE=DATE:` format. Timed events (Google/Apple default) use `DTSTART:20250515T140000Z` and fail silently. Fix in Feature 2 work.

**EventList has no test file.** Bulk ops, search, sort, grouping logic should have tests. Low priority.

---

## Relevant File Paths

- `src/components/AddEventForm.jsx`
- `src/components/EventList.jsx`
- `src/components/EventItem.jsx`
- `src/components/SettingsMenu.jsx`
- `src/utils/sortFilter.js`
- `src/utils/icsParser.js`
- `src/utils/colors.js`
- `src/utils/dates.js`
- `netlify/functions/groq.js`
