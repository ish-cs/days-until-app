# Days Until — Design Language Spec

## Philosophy

Dark, ambient, glass-morphic. The UI feels like looking through frosted glass at a softly lit room. Time feels real and emotional — the large serif numbers are the hero, everything else recedes. High contrast text on deep backgrounds. Generous whitespace. Zero decoration.

---

## Color Tokens

```css
--bg-0: #0a0a0c          /* deepest background — page base */
--bg-1: #111114          /* elevated surface — sidebar, headers */

--ink-0: #ffffff         /* primary text */
--ink-1: rgba(255,255,255,0.72)  /* secondary text */
--ink-2: rgba(255,255,255,0.48)  /* tertiary text */
--ink-3: rgba(255,255,255,0.28)  /* placeholder, disabled, labels */
--ink-4: rgba(255,255,255,0.12)  /* very subtle text */

--line:        rgba(255,255,255,0.08)  /* dividers */
--line-strong: rgba(255,255,255,0.16)  /* input borders, button borders */

--accent:      #f5d76e                  /* golden yellow — primary CTA, active states */
--accent-soft: rgba(245,215,110,0.18)  /* accent tint backgrounds */

--glass-bg:        rgba(255,255,255,0.04)  /* card/surface fill */
--glass-bg-strong: rgba(255,255,255,0.07)  /* hovered card fill */
--glass-border:    rgba(255,255,255,0.10)  /* glass card border */
--glass-blur:      24px                    /* backdrop-filter blur radius */
```

### Event Accent Colors (Tailwind 300)

Applied as 3px left accent bars and color indicator dots on event cards.

| Token | Hex | Usage |
|---|---|---|
| `yellow-300` | `#fde047` | Default |
| `red-300`    | `#fca5a5` | Urgent, birthdays |
| `green-300`  | `#86efac` | Health, goals |
| `blue-300`   | `#93c5fd` | Travel, work |
| `purple-300` | `#c4b5fd` | Personal |
| `pink-300`   | `#f9a8d4` | Celebrations |
| `orange-300` | `#fdba74` | Milestones |
| `teal-300`   | `#5eead4` | Recurring |
| `gray-300`   | `#d1d5db` | Neutral |
| `white`      | `#ffffff`  | Minimal |

---

## Typography

### Typefaces

| Role | Family | Style | Usage |
|---|---|---|---|
| **Display** | Instrument Serif | Regular | Large day countdown numbers |
| **Body** | Geist | Regular / Medium / SemiBold | All UI text |
| **Mono** | Geist Mono | Regular | Dates, technical strings |

Fallback stack: `'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`

Font feature settings: `"ss01", "cv11"` — enabled globally for Geist optical improvements.

### Type Scale

| Role | Family | Size | Weight | Color | Letter-spacing |
|---|---|---|---|---|---|
| Day count (hero) | Instrument Serif | 56px mobile / 38px sm | 400 | `--ink-0` | -0.03em |
| Day count (word mode) | Instrument Serif | 42px / 28px sm | 400 | `--ink-0` | -0.02em |
| Event name | Geist | 16px | 400 | `--ink-0` | — |
| Event date | Geist | 12px | 400 | `--ink-3` | — |
| Unit label ("DAYS") | Geist | 11px | 400 | `--ink-3` | +0.16em uppercase |
| Section header | Geist | 10px | 600 | `--ink-3` | +1.4px uppercase |
| Button | Geist | 13px | 500 | `--ink-1` | — |
| Input | Geist | 14px | 400 | `--ink-0` | — |
| Placeholder | Geist | 14px | 400 | `--ink-3` | — |
| Toast | Geist | 13px | 500 | `--ink-0` | +0.02em |
| Notes | Geist | 12px | 400 | `--ink-1` | — |
| Caption / hint | Geist | 11px | 400 | `--ink-3` | — |

---

## Background & Ambient Atmosphere

The page background is `#0a0a0c`. On top of it, four soft radial gradient glows create a "light behind frosted glass" effect. These never move — they're fixed to the viewport.

```css
/* Applied as body::before — fixed, full-viewport, z-index 0 */
background:
  radial-gradient(900px 700px at 12%  8%,  rgba(245,215,110,0.10), transparent 60%),  /* gold — top left */
  radial-gradient(800px 600px at 92%  28%, rgba(120,140,255,0.10), transparent 60%),  /* blue — top right */
  radial-gradient(700px 600px at 70%  95%, rgba(255,90, 180,0.08), transparent 60%),  /* pink — bottom right */
  radial-gradient(600px 500px at 8%   88%, rgba(80, 210,200,0.07), transparent 60%);  /* teal — bottom left */
```

A fine dot grid overlays everything at 3px spacing, `mix-blend-mode: overlay`, opacity 0.35 — adds subtle texture/depth.

---

## Surfaces & Glass

### `.glass` — Standard glass card

```css
background: rgba(255,255,255,0.04);
backdrop-filter: blur(24px) saturate(140%);
border: 1px solid rgba(255,255,255,0.10);
border-radius: 18px;
box-shadow:
  0 1px 0 rgba(255,255,255,0.06) inset,   /* top edge highlight */
  0 24px 60px -24px rgba(0,0,0,0.6);       /* depth shadow */
```

### `.glass-strong` — Hovered/active glass surface

```css
background: rgba(255,255,255,0.07);
/* all other glass properties inherited */
```

### Border Radii

| Element | Radius |
|---|---|
| Glass cards, sidebars, modals | 18px |
| Buttons | 10px |
| Inputs | 10px |
| Toast chips | 14px |
| Bottom sheets | 20px (top corners only) |
| Color dots | 50% (pill) |
| Accent bars | 2px |
| FAB | 50% |

---

## Event Card

The primary UI unit. 3-column grid layout.

```
┌──────────────────────────────────────────────────┐
│ ║  56          Event Name                      ● │
│ ║  DAYS        Mon, May 19                       │
└──────────────────────────────────────────────────┘
  ^   ^           ^                              ^
  bar number      meta                           dot
  3px 120px col   flex                           auto
```

### Grid spec

```css
grid-template-columns: 120px 1fr auto;
align-items: center;
gap: 20px;
padding: 20px 22px;
```

Mobile (`≤640px`): `grid-template-columns: 80px 1fr auto; gap: 12px; padding: 14px 16px`

### Left accent bar

```css
position: absolute;
left: 0; top: 0; bottom: 0;
width: 3px;
border-radius: 0 2px 2px 0;
background: <event color>;
```

### Day number

```css
font-family: 'Instrument Serif';
font-size: 56px;           /* 38px on mobile */
line-height: 0.95;
letter-spacing: -0.03em;
color: var(--ink-0);
```

Unit label ("DAYS") is a child of the number container:

```css
font-family: 'Geist';
font-size: 11px;
text-transform: uppercase;
letter-spacing: 0.16em;
color: var(--ink-3);
align-self: flex-end;
padding-bottom: 6px;
```

### Hover state

```css
background: var(--glass-bg-strong);  /* rgba(255,255,255,0.07) */
transform: translateY(-1px);
transition: 220ms cubic-bezier(0.22,1,0.36,1);
```

### Past events (date < today)

```css
opacity: 0.34;
filter: grayscale(0.78);
```

On hover: `opacity: 0.50; filter: grayscale(0.55)`

### Calendar highlight state

```css
outline: 2px solid rgba(245,215,110,0.55);
outline-offset: 2px;
```

---

## Interactive Elements

### Button (`.btn`)

```css
font-family: inherit;
font-size: 13px;
color: var(--ink-1);
background: transparent;
border: 1px solid var(--line-strong);  /* rgba(255,255,255,0.16) */
border-radius: 10px;
padding: 7px 12px;
cursor: pointer;
transition: background 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease;

/* Hover */
background: rgba(255,255,255,0.05);
color: var(--ink-0);
border-color: rgba(255,255,255,0.24);

/* Active */
transform: translateY(1px);
```

### Ghost button (`.btn-ghost`)

```css
border-color: transparent;

/* Hover */
border-color: var(--line-strong);
```

### Input (`.input`)

```css
font-family: inherit;
font-size: 14px;
color: var(--ink-0);
background: rgba(255,255,255,0.03);
border: 1px solid var(--line-strong);
border-radius: 10px;
padding: 10px 12px;
outline: none;
width: 100%;
transition: border-color 120ms ease, background 120ms ease;

/* Focus */
border-color: rgba(255,255,255,0.32);
background: rgba(255,255,255,0.05);

/* Placeholder */
color: var(--ink-3);
```

### FAB (Floating Action Button)

Golden circle, fixed bottom-center. Uses `--accent` (#f5d76e) fill with a matching glow shadow.

```css
width: 56px; height: 56px;
border-radius: 50%;
background: var(--accent);
box-shadow: 0 8px 24px rgba(245,215,110,0.35);
```

---

## Motion & Animation

All transitions use `cubic-bezier(0.22, 1, 0.36, 1)` — a custom spring that overshoots slightly, feels physical.

| Element | Property | Duration | Easing |
|---|---|---|---|
| Event card hover | transform, background | 220ms | spring |
| Toast entrance | opacity, transform, scale | 420ms | spring |
| Sidebar expand | height, opacity | 220ms | spring |
| Modal/sheet | opacity, transform | 260ms | spring |
| Inline edit fields | border-color, background | 120ms | ease |
| Button hover | background, color | 120ms | ease |
| Day counter | transform (rollUp) | implicit | spring |

### Keyframes

```css
@keyframes rollUp {
  0%   { transform: translateY(20%); }
  60%  { transform: translateY(-4%); }
  100% { transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes toast-pop-in {
  from { opacity: 0; transform: translate(-50%, -22px) scale(0.92); }
  to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
```

---

## Layout

### Desktop (≥961px)

Two-column layout: fixed sidebar left + scrollable main column right.

```
┌─────────────┬──────────────────────────────┐
│   sidebar   │      main event list         │
│   240px     │      flex: 1                 │
│   fixed     │      max-width: 1280px       │
└─────────────┴──────────────────────────────┘
                        ↑
                  AddEventForm (fixed bottom)
```

### Mobile (≤960px)

Single column. Sidebar collapses to top of page (mini-calendar hidden, just user avatar + settings). AddEventForm docks to bottom as fixed composer.

```css
--mobile-composer-reserve: 152px;  /* space reserved for fixed bottom composer */
--layout-pad-x: 16px;             /* horizontal page padding (32px on desktop) */
```

### Scrollbar

```css
width: 10px;
background: transparent;
thumb: rgba(255,255,255,0.08), 2px transparent border, border-radius 999px
thumb:hover: rgba(255,255,255,0.18)
```

---

## Component Details

### Toast

Fixed top-center. Glass chip. Color tinted by type.

```
Success: green-300/12% bg + green-300/32% border
Error:   red-300/12% bg + red-300/35% border
```

### Section headers

```css
font-size: 10px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 1.4px;
color: var(--ink-3);
```

Accompanied by a `--line` (rgba(255,255,255,0.08)) horizontal rule.

### Color dot (on event card)

```css
width: 9px; height: 9px;
border-radius: 50%;
background: <event color>;
```

### Recurrence badge

Small pill shown on event card when event has recurrence set.

```css
font-size: 10px;
padding: 2px 6px;
border-radius: 6px;
background: rgba(255,255,255,0.06);
border: 1px solid rgba(255,255,255,0.10);
color: var(--ink-2);
```

### Notes (on event card)

Collapsed by default. Expand on click. Second click to edit inline.

```css
font-size: 12px;
line-height: 1.4;
color: var(--ink-1);
```

Add-note hint: `.add-note-hint` — invisible until card hover, `opacity: 0 → 1` on hover.

### Mini Calendar (sidebar)

Glass surface. Current day highlighted with `--accent` circle. Selected date gets `--accent-soft` background. Days from other months shown at `--ink-4` opacity.

---

## Quick Add Composer

Fixed bottom bar (mobile) or inline top form (desktop). Two modes:

**Standard mode:** Name input + date picker + time input + notes textarea + color picker + submit.

**Quick Add mode:** Single text field. User types natural language. On submit, calls Groq API to parse name, date, time, color, recurrence. Shows AI-parsed chips below input as feedback.

Composer sits above the safe area inset (`env(safe-area-inset-bottom)`) on mobile.

---

## Inline Editing

All event fields are editable in-place on the card. Click to edit:

- **Name:** Becomes a transparent input at same font size (16px). Border appears on focus (`rgba(255,255,255,0.28)`).
- **Date:** Native `<input type="date">` styled to look identical to the text it replaces.
- **Time:** Native `<input type="time">`. Shown as `h:mm AM/PM`. "+ time" hint appears on card hover if no time set.
- **Notes:** Textarea at 12px. Expands to fit content.

Commit on `Enter` or `blur`. Cancel on `Escape`. Empty name → restore previous value.

---

## Favicon / PWA

Dynamic favicon: SVG that updates based on the next upcoming event's day count and accent color. Updates every minute via `useDynamicFavicon` hook. PWA manifest, service worker for offline support and push notifications.

---

## Icons

**Library:** [Lucide React](https://lucide.dev/) (`lucide-react@1.14.0`)

Stroke-based, 24x24 grid, consistent 1.5px stroke weight. Inherits `currentColor` — set color via CSS or Tailwind on the parent.

**Usage:**
```jsx
import { Search, SlidersHorizontal, Trash2, Bell } from 'lucide-react';

// Size and color via props
<Search size={16} color="var(--ink-3)" />

// Or via className (Tailwind)
<Search className="text-white/48 w-4 h-4" />
```

**Stroke width:** Default is `2`. Use `strokeWidth={1.5}` for large decorative icons, `strokeWidth={2}` for UI icons at 16-20px.

**Do not** use `react-icons` or any other icon package — keep a single source of truth.

---

## Anti-patterns (what this design avoids)

- No white backgrounds
- No colored backgrounds (non-black/glass)
- No shadows that aren't dark and subtle
- No borders wider than 1px
- No text heavier than SemiBold in UI (SemiBold reserved for labels/CTAs)
- No decorative icons — only semantic ones
- No emojis anywhere in the UI — not in labels, buttons, suggestions, placeholders, or content
- No rounded corners above 20px (except FAB and color dots)
- No gradients on text
- No animations longer than 420ms
- No horizontal rules thicker than 1px
