# Dynamic Date Favicon

## Goal

The browser tab favicon always shows today's date, updating automatically at midnight without a page reload — similar to the macOS Calendar app icon.

## Approach

SVG data URL favicon injected via JavaScript. Safari falls back gracefully to the existing static `favicon.ico`.

## Implementation

**New file:** `src/hooks/useDynamicFavicon.js`

- Builds a 32×32 SVG string with:
  - Red top band (~8px tall) showing the 3-letter abbreviated month in white (e.g. "MAY")
  - White/light bottom area with the bold day number in dark text (e.g. "3")
  - Rounded corners (rx="4")
- Encodes the SVG as a `data:image/svg+xml;utf8,...` URL
- Finds or creates the `<link rel="icon">` element and sets its `href`
- Schedules a `setTimeout` to fire at the next midnight and re-run, keeping the date current

**Modified file:** `src/App.jsx`

- Import and call `useDynamicFavicon()` at the top of the `App` component (before the auth loading check, so it runs immediately on mount)

## Scope

2 files touched. No changes to `index.html`, `public/assets/favicon.ico`, or any other file.

## Browser compatibility

- Chrome, Firefox, Edge: SVG favicon renders the dynamic date
- Safari: ignores SVG favicons, falls back to `favicon.ico` (static, no date) — acceptable degradation
