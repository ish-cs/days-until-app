# Recurring Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly/monthly/yearly recurrence to events. Past recurring events auto-advance to next occurrence on the fly — no Firestore writes needed.

**Architecture:** Add `recurrence` field to Firestore event schema. `getNextOccurrence` + `getEffectiveDate` utility functions compute the active date at render time. All consumers (sort, display, autoDelete) use effective date. Quick-add LLM detects recurrence patterns and returns a `recurrence` field.

**Tech Stack:** React, Firestore, Groq LLM (llama-3.3-70b), vanilla JS date math

---

### Task 1: Core utility functions in dates.js

**Files:**
- Modify: `src/utils/dates.js`

- [ ] **Step 1: Add `getNextOccurrence` and `getEffectiveDate` to `src/utils/dates.js`**

Append to the end of the file:

```js
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
```

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
node --input-type=module < src/utils/dates.js 2>&1 || echo "error above"
```

Expected: no output (or just the echo if there's an error — fix before continuing).

- [ ] **Step 3: Commit**

```bash
git add src/utils/dates.js
git commit -m "feat(recurrence): add getNextOccurrence and getEffectiveDate utilities"
```

---

### Task 2: Update EventList — autoDelete and sorting

**Files:**
- Modify: `src/components/EventList.jsx`

- [ ] **Step 1: Add import for `getEffectiveDate`**

At the top of `src/components/EventList.jsx`, update the dates import:

```js
import { calculateDaysLeft, getEffectiveDate } from '../utils/dates.js';
```

- [ ] **Step 2: Update autoDelete check to skip recurring events**

Find this block (around line 43):
```js
docs.forEach(event => {
  if (calculateDaysLeft(event.date) < 0) {
    batch.delete(doc(db, 'users', uid, 'events', event.id));
  } else {
    kept.push(event);
  }
});
```

Replace with:
```js
docs.forEach(event => {
  if (calculateDaysLeft(event.date) < 0 && !event.recurrence) {
    batch.delete(doc(db, 'users', uid, 'events', event.id));
  } else {
    kept.push(event);
  }
});
```

- [ ] **Step 3: Update sort to use effective date**

Find (around line 54):
```js
docs.sort((a, b) => calculateDaysLeft(a.date) - calculateDaysLeft(b.date));
```

Replace with:
```js
docs.sort((a, b) => calculateDaysLeft(getEffectiveDate(a)) - calculateDaysLeft(getEffectiveDate(b)));
```

- [ ] **Step 4: Commit**

```bash
git add src/components/EventList.jsx
git commit -m "feat(recurrence): skip autoDelete and sort by effective date for recurring events"
```

---

### Task 3: Update EventItem — display next occurrence + badge

**Files:**
- Modify: `src/components/EventItem.jsx`

- [ ] **Step 1: Add import for `getEffectiveDate`**

Update the dates import at the top:

```js
import { calculateDaysLeft, formatFullDate, getDayOfWeek, getEffectiveDate } from '../utils/dates.js';
```

- [ ] **Step 2: Use effective date for days and display**

Find (around line 20):
```js
const days = calculateDaysLeft(event.date);
const fullDate = formatFullDate(event.date);
```

Replace with:
```js
const effectiveDate = getEffectiveDate(event);
const days = calculateDaysLeft(effectiveDate);
const fullDate = formatFullDate(effectiveDate);
```

- [ ] **Step 3: Add recurrence badge below event name**

Find the `.event-name-line` div (around line 176):
```jsx
<div
  className="event-name-line"
  onClick={() => startEdit('name', event.name)}
  title="Click to edit name"
>
  {event.name}
</div>
```

Replace with:
```jsx
<div
  className="event-name-line"
  onClick={() => startEdit('name', event.name)}
  title="Click to edit name"
>
  {event.name}
  {event.recurrence && (
    <span className="recurrence-badge">
      ↻ {event.recurrence.charAt(0).toUpperCase() + event.recurrence.slice(1)}
    </span>
  )}
</div>
```

- [ ] **Step 4: Add badge style to `public/assets/style.css`**

Append to `public/assets/style.css`:

```css
.recurrence-badge {
  display: inline-block;
  margin-left: 6px;
  font-size: 11px;
  font-weight: 500;
  opacity: 0.6;
  vertical-align: middle;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/EventItem.jsx public/assets/style.css
git commit -m "feat(recurrence): show next occurrence date and recurrence badge on event cards"
```

---

### Task 4: AddEventForm — recurrence dropdown + saveEvent

**Files:**
- Modify: `src/components/AddEventForm.jsx`

- [ ] **Step 1: Add recurrence state**

Find (around line 14):
```js
const [selectedColor, setSelectedColor] = useState('yellow-300');
```

Add below it:
```js
const [recurrence, setRecurrence] = useState('');
```

- [ ] **Step 2: Reset recurrence on submit (standard mode)**

Find in `handleSubmit` (around line 37):
```js
setName('');
setDate('');
setTime('');
```

Replace with:
```js
setName('');
setDate('');
setTime('');
setRecurrence('');
```

- [ ] **Step 3: Update saveEvent to accept and store recurrence**

Find (around line 82):
```js
async function saveEvent(eventName, eventDate, eventTime, bgColor) {
  if (!uid) return;
  await addDoc(collection(db, 'users', uid, 'events'), {
    name: eventName,
    date: eventDate,
    time: eventTime,
    bgColor,
    owner: uid
  });
  showToast('Event added!', 'success');
}
```

Replace with:
```js
async function saveEvent(eventName, eventDate, eventTime, bgColor, eventRecurrence) {
  if (!uid) return;
  const payload = { name: eventName, date: eventDate, time: eventTime, bgColor, owner: uid };
  if (eventRecurrence) payload.recurrence = eventRecurrence;
  await addDoc(collection(db, 'users', uid, 'events'), payload);
  showToast('Event added!', 'success');
}
```

- [ ] **Step 4: Pass recurrence in standard submit**

Find (around line 39):
```js
await saveEvent(name.trim(), date, time, selectedColor);
```

Replace with:
```js
await saveEvent(name.trim(), date, time, selectedColor, recurrence);
```

- [ ] **Step 5: Add recurrence dropdown to composer-meta row**

Find in the JSX (around line 113), the closing of the `composer-swatches` div:
```jsx
</div>
            </div>
          )}
```

Add the `<select>` before the closing `</div>` of `composer-meta`:
```jsx
              <select
                className="input composer-input-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                aria-label="Recurrence"
              >
                <option value="">Does not repeat</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
```

Exactly after the `composer-swatches` div and before the closing `</div>` of `composer-meta`.

- [ ] **Step 6: Add dropdown style to `public/assets/style.css`**

Append:
```css
.composer-input-recurrence {
  font-size: 12px;
  padding: 4px 8px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--glass-bg);
  color: var(--ink-1);
  cursor: pointer;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/AddEventForm.jsx public/assets/style.css
git commit -m "feat(recurrence): add recurrence dropdown to event composer"
```

---

### Task 5: Groq function — LLM recurrence detection

**Files:**
- Modify: `netlify/functions/groq.js`

- [ ] **Step 1: Update the LLM prompt to extract recurrence**

Find the `prompt` string (around line 50). Replace the entire prompt template with:

```js
const prompt = `Today is ${today} (${todayWeekday}). The user's phrase may contain a date/time — precise calendar dates are resolved separately; focus on meaning.

Extract:
1) Event title/name — short, human (strip leading filler like "remind me to").
2) time as HH:MM 24-hour if explicitly stated; else "".
3) color: yellow-300 | red-300 | green-300 | blue-300 | purple-300 | pink-300 | orange-300 | teal-300 | gray-300 | white (default yellow-300).
4) recurrence: "weekly" if phrase implies every week (e.g. "every Friday", "every week", "weekly"); "monthly" if every month; "yearly" if every year or annually; null otherwise.

If no usable title: name null.

Existing events (context only):
${context.map(e => `- ${e.name} on ${e.date}${e.time ? ` at ${e.time}` : ''}`).join('\n') || '(none)'}

User phrase:
"${userInput}"

Return ONLY JSON:
{ "name": "string or null", "time": "HH:MM or empty string", "color": "tailwind token", "recurrence": "weekly"|"monthly"|"yearly"|null }`;
```

- [ ] **Step 2: Include recurrence in the merged response**

Find (around line 90):
```js
const merged = {
  name: name || null,
  date: structured.date ?? null,
  time: structured.time || llmTime || "",
  color: resolvedColor,
};
```

Replace with:
```js
const ALLOWED_RECURRENCES = new Set(['weekly', 'monthly', 'yearly']);
const llmRecurrence = ALLOWED_RECURRENCES.has(parsed.recurrence) ? parsed.recurrence : null;

const merged = {
  name: name || null,
  date: structured.date ?? null,
  time: structured.time || llmTime || "",
  color: resolvedColor,
  recurrence: llmRecurrence,
};
```

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/groq.js
git commit -m "feat(recurrence): extend Groq LLM to detect and return recurrence field"
```

---

### Task 6: Wire quick-add recurrence into AddEventForm

**Files:**
- Modify: `src/components/AddEventForm.jsx`

- [ ] **Step 1: Pass recurrence from quick-add Groq response to saveEvent**

Find in `handleQuickAdd` (around line 75):
```js
const eventColor = data.color || selectedColor;
await saveEvent(data.name, data.date, data.time || '', eventColor);
```

Replace with:
```js
const eventColor = data.color || selectedColor;
const eventRecurrence = data.recurrence || '';
await saveEvent(data.name, data.date, data.time || '', eventColor, eventRecurrence);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AddEventForm.jsx
git commit -m "feat(recurrence): wire quick-add LLM recurrence into saveEvent"
```

---

### Task 7: Build verification

- [ ] **Step 1: Run build**

```bash
npm run build 2>&1
```

Expected: `✓ built` with no errors (chunk size warning is OK).

- [ ] **Step 2: Commit docs**

```bash
git add docs/
git commit -m "docs: add recurring events spec and implementation plan"
```
