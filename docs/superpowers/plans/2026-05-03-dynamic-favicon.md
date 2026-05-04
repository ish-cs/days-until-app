# Dynamic Date Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser tab favicon always display today's date (day number + month name), updating automatically at midnight.

**Architecture:** A `useDynamicFavicon` React hook builds a 32×32 SVG string with today's date, encodes it as a data URL, and injects it into the `<link rel="icon">` element. A `setTimeout` fires at midnight to refresh the date without a page reload. Safari falls back silently to the static `favicon.ico`.

**Tech Stack:** React hooks, inline SVG, browser DOM API

---

### Task 1: Create `useDynamicFavicon` hook

**Files:**
- Create: `src/hooks/useDynamicFavicon.js`

- [ ] **Step 1: Create the hook file**

Create `src/hooks/useDynamicFavicon.js` with this content:

```js
import { useEffect } from 'react';

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function buildFaviconSvg(date) {
  const day = date.getDate();
  const month = MONTH_ABBR[date.getMonth()];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="4" fill="#ffffff"/>
  <rect width="32" height="9" rx="0" fill="#e03131"/>
  <rect x="0" y="5" width="32" height="4" fill="#e03131"/>
  <text x="16" y="8.5" font-family="system-ui,sans-serif" font-size="6" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${month}</text>
  <text x="16" y="22" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">${day}</text>
</svg>`;
}

function setFavicon(svgString) {
  const encoded = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = encoded;
}

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return midnight - now;
}

export function useDynamicFavicon() {
  useEffect(() => {
    function update() {
      setFavicon(buildFaviconSvg(new Date()));
    }

    update();

    let timer = setTimeout(function tick() {
      update();
      timer = setTimeout(tick, msUntilMidnight());
    }, msUntilMidnight());

    return () => clearTimeout(timer);
  }, []);
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls src/hooks/useDynamicFavicon.js
```

Expected: file listed with no error.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDynamicFavicon.js
git commit -m "feat: add useDynamicFavicon hook"
```

---

### Task 2: Wire hook into App

**Files:**
- Modify: `src/App.jsx:1-12`

- [ ] **Step 1: Add import to App.jsx**

In `src/App.jsx`, add this import after the existing hook imports (around line 11):

```js
import { useDynamicFavicon } from './hooks/useDynamicFavicon.js';
```

- [ ] **Step 2: Call hook inside App component**

In `src/App.jsx`, add the hook call as the first line inside the `App` function body (line 14, before any state declarations):

```js
export default function App() {
  useDynamicFavicon();
  const [user, setUser] = useState(null);
  // ... rest unchanged
```

- [ ] **Step 3: Verify the app still loads**

```bash
npm run dev
```

Open `http://localhost:5173` in Chrome or Firefox. The browser tab favicon should show today's date (e.g. a red band with "MAY" and "3" below it). No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire dynamic date favicon into App"
```
