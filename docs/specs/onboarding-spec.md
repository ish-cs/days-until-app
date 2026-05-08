# Onboarding Flow Spec — Days Until

**Goal:** Get new users to their "aha moment" (a populated, personal countdown timeline) in under 3 minutes. Target: ≥ 5 events added in first session for ≥ 50% of new users.

---

## 1. First-Time User Detection

### Primary Flag: Firestore User Document

On Google Sign-In, the app reads (or creates) a Firestore document at `users/{uid}`. The document includes:

```js
{
  onboardingComplete: false,   // set to true when user dismisses completion screen
  onboardingStep: 0,           // last completed step index (0–5), for resume logic
  onboardingStartedAt: null,   // server timestamp, set on first trigger
  createdAt: <serverTimestamp>
}
```

**Detection logic (in `App.jsx`, immediately after auth resolves):**

1. After `onAuthStateChanged` fires with a non-null user, fetch `users/{uid}`.
2. If doc does not exist → new user → create doc, set `onboardingComplete: false`, trigger onboarding.
3. If doc exists and `onboardingComplete === false` → mid-flow drop-off → resume (see §3).
4. If doc exists and `onboardingComplete === true` → skip onboarding entirely.

### Why not localStorage?

Google Sign-In is cross-device. A user who signs in on mobile then desktop should not re-experience onboarding. Firestore is source of truth; localStorage is not used for this flag.

### Skip Condition

Onboarding is skipped if `onboardingComplete === true` OR if the user has ≥ 5 existing events (safety valve for power users imported via ICS or API).

---

## 2. Onboarding Flow — Step by Step

The onboarding is rendered as a **full-page overlay** (`fixed inset-0 z-50 bg-white`) that sits above the main app shell. It is NOT a modal — it takes the full viewport so users are not distracted by the empty event list behind it.

Navigation: step indicator dots at the top (max 5 dots, one per step). Back arrow top-left (hidden on step 0). "Skip" link top-right (skips to completion, marks onboarding complete).

Transitions: horizontal slide via CSS `translate-x` or a lightweight library like `framer-motion` if already in the bundle. Each step mounts/unmounts.

---

### Step 0 — Welcome

**Purpose:** Orient the user, deliver the value prop in one sentence, reduce cognitive load before asking for input.

**UI:**
- Full-page, centered column, max-width `max-w-sm mx-auto`, vertically centered with `flex flex-col items-center justify-center h-full gap-6`.
- App icon or wordmark at top (existing brand asset).
- Headline (large, bold): `"See exactly how far away everything is."`
- Subhead (muted, `text-gray-500 text-sm text-center`): `"Add birthdays, trips, deadlines, and milestones — Days Until counts down to all of them."`
- Primary CTA button (`w-full`, rounded-full, brand color): `"Get started →"`
- Below CTA, tiny link: `"Already have events? Sign in →"` — this is already handled by auth, so this link is a no-op / cosmetic only if they're signed in.

**User action:** Tap "Get started".

**Next:** Advance to Step 1. Write `onboardingStep: 1` to Firestore.

**Skip/back:** No back. "Skip" in top-right jumps to completion (Step 5).

---

### Step 1 — Quick-Add Suggestion Cards

**Purpose:** Reduce blank-slate paralysis. Surface the most common event types so users don't have to think about what to add. Pre-selection is the first micro-commitment.

**UI:**
- Headline: `"What's coming up for you?"`
- Subhead: `"Pick one to get started — you can add more after."`
- Grid of suggestion cards: `grid grid-cols-2 gap-3 w-full`. Six cards total:

| Card label | Pre-fill behavior |
|---|---|
| My birthday | Name = "My Birthday", auto-fill today's month/day for next year |
| Upcoming trip | Name = "My Trip", date = blank (user fills) |
| Work deadline | Name = "Deadline:", date = blank |
| Friend's wedding | Name = "Wedding", date = blank |
| Holiday | Name = blank, date = blank, shows holiday picker sub-step |
| Something else | No pre-fill, opens blank form |

Each card: `rounded-2xl border border-gray-200 p-4 flex flex-col items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-colors`. Selected card gets `border-brand-500 bg-brand-50 ring-2 ring-brand-500`.

**User action:** Tap a card to select it.

**Next:** Tapping any card immediately advances to Step 2 with the card's pre-fill data passed as props. No explicit "Next" button — the tap IS the commit.

**Skip/back:** Back returns to Step 0. Skip jumps to Step 5.

---

### Step 2 — First Event Creation (Guided)

**Purpose:** Complete the first event add. This is the core action — everything else scaffolds toward this moment.

**UI:**
- Headline: `"Let's add your first event"` (or `"Tell us more about [card label]"` if pre-filled).
- Render the existing `<AddEventForm>` component, but with:
  - Pre-filled `name` and `date` values from Step 1 card selection (if any).
  - A helper hint below the name field: `"Give it a name you'll recognize"` (`text-xs text-gray-400`).
  - AI quick-add field (already built) is available and prominently labeled: `"Or describe it in plain English →"`.
  - The form's normal "Add Event" submit button replaced with `"Add my first event →"` (same behavior, different copy).
- Below the form, a soft nudge: `"Your events are private to you."` (`text-xs text-gray-400 text-center mt-4`).

**User action:** Fill in name + date (manually or via AI quick-add) and submit.

**What happens on submit:**
1. Event is written to Firestore as normal (existing logic).
2. App advances to Step 3 (not Step 5 — the user must see the "add more" prompt).
3. Write `onboardingStep: 3` to Firestore.

**Skip/back:** Back returns to Step 1. Skip jumps to Step 5.

**Success state:** A brief (`500ms`) green checkmark flash on the submit button before advancing.

---

### Step 3 — Add More (Social Proof Prompt)

**Purpose:** After the first event, use social proof to nudge the user to add more before leaving. This is the highest-leverage step for hitting the 5-event target.

**UI:**
- Centered column, `max-w-sm mx-auto`.
- A small "event added" confirmation at top: a `rounded-xl bg-green-50 border border-green-200 p-3` tile showing the just-added event name and days-until count. This is the first moment users see the core value of the app.
- Headline: `"Nice! Now let's fill in your timeline."`
- Social proof line (`text-sm text-gray-500 text-center`): `"People who track 5+ events check the app every day. You have 1."`
- Below: same 6 suggestion cards from Step 1, but any already-used card is grayed out / disabled.
- Below the grid, a secondary CTA link: `"I'll add more later →"` which advances to Step 4 (notification opt-in).
- Primary action: tapping a card opens a **slide-up sheet** (bottom sheet, `fixed bottom-0 inset-x-0 rounded-t-2xl bg-white shadow-xl p-6 z-60`) containing `<AddEventForm>` pre-filled with the card data. Sheet has a drag handle and "×" dismiss button.

**Repeat behavior:** Each time the user adds an event via the sheet:
1. Sheet closes.
2. The added-event tile updates to show the latest addition (brief slide-in animation).
3. The used card grays out.
4. Event count in the social proof line updates: `"You have 2."` → `"You have 3."` etc.
5. After 2+ events added here (3+ total), the "I'll add more later" link changes to `"That's enough for now →"`.

**When to advance:** After 4 total events OR after user taps "I'll add more later" / "That's enough for now".

**Skip/back:** No back (the event is already saved). Skip advances to Step 4.

---

### Step 4 — Notification Opt-In

**Purpose:** Opt users into push notifications AFTER they've added ≥ 2 events, so they have a reason to care. Never ask before value is demonstrated.

**Condition gate:** Only show this step if the app supports push notifications in the current environment (check `'Notification' in window && Notification.permission === 'default'`). If permission already granted or denied, or if on a platform where push isn't supported (iOS PWA caveat), skip directly to Step 5.

**UI:**
- Simple bell icon (SVG, --ink-2 color, ~48px)
- Headline: `"Never forget what's coming up."`
- Body (`text-sm text-gray-500 text-center`): `"Get a reminder a week before each event so you're never caught off guard."`
- Primary CTA: `"Turn on reminders"` → calls `Notification.requestPermission()`. On grant: advance to Step 5. On deny: advance to Step 5 silently (no guilt-trip).
- Secondary link below: `"Not now"` → advance to Step 5.

**Skip/back:** No back. No explicit skip — both buttons advance.

---

### Step 5 — Completion / Dashboard Reveal

**Purpose:** Celebrate the completed onboarding, reveal the full timeline, and anchor the habit.

**UI (2-phase):**

**Phase A — Celebration (1.5 seconds, then auto-advance):**
- Full-page, centered.
- Large animated checkmark or confetti burst (CSS-only or a small `canvas-confetti` call — keep bundle impact minimal).
- Headline: `"Your timeline is ready."`
- Subhead: `"You're tracking [N] events. Check back anytime to see the countdown."` where N is the actual count.

**Phase B — Reveal:**
- The overlay fades out (`opacity-0 transition-opacity duration-500`) revealing the main app behind it.
- The event list animates in with a staggered `translate-y` entrance (50ms delay per card).
- The overlay unmounts after fade completes.
- `onboardingComplete: true` is written to Firestore.

**Fallback:** If the user skipped all event-adding steps and has 0 events, Phase A copy changes to: `"You're all set. Start adding events whenever you're ready."` — no confetti, just a calm transition.

---

## 3. Persistent Progress State

### Drop-Off Resume Logic

`onboardingStep` in Firestore tracks the last step index written (0–5). On re-login:

- `onboardingStep === 0` → restart from Step 0 (user never got past welcome).
- `onboardingStep === 1` → resume at Step 1 (suggestion cards).
- `onboardingStep === 2` → resume at Step 2, but check if any events exist. If yes (user added one then closed), advance to Step 3.
- `onboardingStep === 3` → resume at Step 3 with current event count loaded from Firestore.
- `onboardingStep === 4` → resume at Step 4 (notification prompt).
- If `onboardingStep >= 5` and `onboardingComplete === false` → something went wrong; mark complete and skip.

### Implementation note

Read `onboardingStep` immediately after auth resolves, before rendering anything. Store locally in React state (`const [onboardingStep, setOnboardingStep] = useState(null)`). Don't start rendering the app shell until this is resolved (show a full-screen spinner or skeleton during the Firestore fetch — this fetch is already happening for the event list, so no extra latency).

---

## 4. Re-Engagement for Sparse Users

### Trigger Condition

Show a soft prompt if all three are true:
- `onboardingComplete === true` (so they're not mid-flow)
- User has < 3 events in Firestore
- `createdAt` is > 7 days ago (use server timestamp diff)

Evaluate this condition once per session, on app load, after the event list is fetched.

### Prompt UI

A **dismissable banner** at the top of the event list (not a modal — don't block the UI):

```
You're only tracking [N] event[s].
Most users track 8+. Want some ideas?   [Add events]   [×]
```

Layout: `rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3 mb-4`. Dismiss (×) sets a `reEngagementDismissedAt` timestamp in Firestore; don't show again for 14 days.

Tapping "Add events →" opens the suggestion card sheet (same component from Step 3, as a standalone sheet, not the full onboarding flow).

### Seasonal Suggestion Relevance

When populating the suggestion cards in the re-engagement sheet, sort and prioritize by current month:

| Month range | Prioritized suggestions |
|---|---|
| Nov–Dec | Holiday party, New Year's Eve, Gift deadline |
| Jan | New Year resolution milestone, Tax deadline |
| Feb | Valentine's Day, anniversary |
| Mar–May | Spring trip, graduation, Mother's Day |
| Jun–Aug | Summer vacation, Fourth of July, back-to-school |
| Sep–Oct | Halloween, Thanksgiving |

This is a simple `switch (currentMonth)` in a utility function — no ML needed.

---

## 5. Empty State (Post-Onboarding)

If a user who has completed onboarding deletes all events (or returns with 0 events and `onboardingComplete === true`), render this in place of the event list:

**UI:**

```
[large calendar icon, ~64px, text-gray-300]

"Nothing on your radar yet."

"Add your first event — a birthday, trip, deadline,
 or anything you're looking forward to."

[+ Add an event]   ← primary button, brand color, rounded-full
```

Container: `flex flex-col items-center justify-center gap-3 py-20 text-center`. Headline: `text-lg font-semibold text-gray-700`. Body: `text-sm text-gray-400 max-w-xs`. CTA: same style as the main add button.

**Do NOT show:** the onboarding flow again. The CTA opens the normal add form (or the existing quick-add flow). The empty state is calm and inviting, not alarming.

---

## 6. Success Criteria

### Primary Metric

**D1 Event Depth:** % of new users who add ≥ 5 events in their first session.
- **Target:** ≥ 50%.
- **Baseline:** Measure current rate for 2 weeks before shipping onboarding.

### Secondary Metrics

| Metric | Target | How to measure |
|---|---|---|
| Onboarding completion rate | ≥ 70% reach Step 5 | Log `onboardingStep` transitions in Firestore or analytics |
| Step 3 engagement | ≥ 60% add ≥ 1 additional event in Step 3 | Event count delta between Step 2 exit and Step 3 exit |
| D7 retention (≥ 1 app open) | ≥ 40% | Session log in Firestore or Firebase Analytics |
| Notification opt-in rate | ≥ 30% | Permission grant rate on Step 4 |
| Re-engagement banner CTR | ≥ 15% | Clicks on "Add events →" / banner impressions |

### Instrumentation

Log these Firestore writes (or Firebase Analytics events) at each step transition:

```
onboarding_step_started   { step: 0–5, uid }
onboarding_step_completed { step: 0–5, uid }
onboarding_event_added    { step: 2 | 3, uid, eventName }
onboarding_completed      { totalEvents: N, uid }
onboarding_skipped        { atStep: N, uid }
```

No external analytics SDK needed — Firestore document diffs are sufficient for an early-stage product.

### Iteration Trigger

If D1 event depth < 35% after 2 weeks: A/B test Step 3 copy. If completion rate < 50%: the flow is too long — cut Step 4 (notification opt-in) and surface it post-onboarding instead.
