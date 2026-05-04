# Recurring Events Design

## Goal

Allow events to recur weekly, monthly, or yearly. Past recurring events auto-advance to the next occurrence instead of going stale or being deleted.

## Data Model

Add one optional field to existing Firestore event documents:

```
recurrence: 'weekly' | 'monthly' | 'yearly'   // absent or undefined = one-off
```

The existing `date` field becomes the anchor date (e.g. `"1990-03-14"` for a birthday). No migration needed — absence of `recurrence` means one-off behavior unchanged.

## Core Logic (`src/utils/dates.js`)

**`getNextOccurrence(anchorDateStr, recurrence)`** — returns a YYYY-MM-DD string:
- If anchor >= today, returns anchor unchanged
- `yearly`: advance year-by-year until date >= today
- `monthly`: advance month-by-month (same day) until date >= today
- `weekly`: advance by 7-day increments until date >= today

**`getEffectiveDate(event)`** — returns `event.recurrence ? getNextOccurrence(event.date, event.recurrence) : event.date`

All consumers (sort, display, days-left) call `getEffectiveDate` instead of using `event.date` directly.

## EventList (`src/components/EventList.jsx`)

- AutoDelete check: `calculateDaysLeft(event.date) < 0 && !event.recurrence`
- Sort: `calculateDaysLeft(getEffectiveDate(a)) - calculateDaysLeft(getEffectiveDate(b))`

## EventItem (`src/components/EventItem.jsx`)

- `days` computed from `calculateDaysLeft(getEffectiveDate(event))`
- `fullDate` / `dateDisplay` computed from `getEffectiveDate(event)`
- Show small recurrence badge below event name when `event.recurrence` is set (e.g. "↻ Weekly")
- Date inline edit still writes to `event.date` (anchor), not effective date

## AddEventForm (`src/components/AddEventForm.jsx`)

- Add a `<select>` dropdown in the `.composer-meta` row (standard mode only):
  - Options: `""` = Does not repeat, `"weekly"` = Weekly, `"monthly"` = Monthly, `"yearly"` = Yearly
- `saveEvent` gains a `recurrence` param; only writes to Firestore if non-empty
- Quick add: if Groq response includes `recurrence`, pass it to `saveEvent`

## Groq Function (`netlify/functions/groq.js`)

- Extend LLM prompt to extract a `recurrence` field:
  - `"weekly"` for "every Friday", "every week", "weekly"
  - `"monthly"` for "every month", "monthly"
  - `"yearly"` for "every year", "annually", "every [month name]"
  - `null` if no recurrence implied
- Extend merged response to include `recurrence`
- Anchor date: LLM/chrono resolves date as normal (next Friday for "every Friday", etc.)

## Browser Compatibility

Pure JS date math — no new dependencies.

## Scope

6 files touched: `src/utils/dates.js`, `src/components/EventList.jsx`, `src/components/EventItem.jsx`, `src/components/AddEventForm.jsx`, `netlify/functions/groq.js`. No schema migration. No new files needed.
