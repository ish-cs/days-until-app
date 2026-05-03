import * as chrono from "chrono-node";
import { resolveSingleWeekdayDate } from "./weekdayResolve.js";

/** Interpret client calendar date YYYY-MM-DD at UTC noon (matches weekday resolver). */
function parseRefDate(todayISO) {
  const [y, m, d] = todayISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

export function toLocalISO(d) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function addDaysISO(todayISO, deltaDays) {
  const [y, m, d] = todayISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return toLocalISO(dt);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Pull 24h HH:MM from first chrono match when hour is known. */
function timeFromChronoStart(start) {
  try {
    if (!start?.isCertain?.("hour")) return "";
    const h = start.get("hour");
    const mi = start.get("minute") ?? 0;
    if (h == null) return "";
    return `${pad2(h)}:${pad2(mi)}`;
  } catch {
    return "";
  }
}

/**
 * High-confidence relative phrases (works inside longer dash-separated strings).
 */
export function tryExplicitRelativePatterns(fragment, todayISO) {
  const t = fragment.trim();
  if (!t || !todayISO) return null;

  let m = t.match(/\bin\s+(\d+)\s+days?\b/i);
  if (m) return addDaysISO(todayISO, parseInt(m[1], 10));

  m = t.match(/\b(\d+)\s+days?\s+from\s+(?:now|today)\b/i);
  if (m) return addDaysISO(todayISO, parseInt(m[1], 10));

  m = t.match(/\bin\s+(\d+)\s+weeks?\b/i);
  if (m) return addDaysISO(todayISO, parseInt(m[1], 10) * 7);

  m = t.match(/\bin\s+a\s+couple\s+(?:of\s+)?days\b/i);
  if (m) return addDaysISO(todayISO, 2);

  if (/\bday\s+after\s+tomorrow\b/i.test(t)) return addDaysISO(todayISO, 2);
  if (/\btomorrow\b/i.test(t)) return addDaysISO(todayISO, 1);
  if (/\bin\s+a\s+day\b/i.test(t) || /\bin\s+one\s+day\b/i.test(t)) return addDaysISO(todayISO, 1);
  if (/\bin\s+a\s+week\b/i.test(t)) return addDaysISO(todayISO, 7);
  if (/\bnext\s+week\b/i.test(t)) return addDaysISO(todayISO, 7);

  return null;
}

const COLOR_SEGMENT = /^(yellow|red|green|blue|purple|pink|orange|teal|gray|grey|white)(?:-300)?$/i;

/**
 * When the LLM omits a title, derive one from dash-separated quick-add shapes:
 * "red - movie night - in 2 days" → "movie night"
 */
export function extractFallbackTitle(userInput) {
  if (!userInput || typeof userInput !== "string") return null;
  const normalized = userInput.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const segments = normalized.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
  const kept = segments.filter((seg) => {
    if (COLOR_SEGMENT.test(seg)) return false;
    if (tryExplicitRelativePatterns(seg, "2020-06-15")) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(seg)) return false;
    return true;
  });

  const title = kept.join(" ").replace(/\s+/g, " ").trim();
  return title.length ? title : null;
}

function collectChronoTime(fullText, ref) {
  const results = chrono.casual.parse(fullText.trim(), ref, { forwardDate: true });
  if (!results.length) return "";
  return timeFromChronoStart(results[0].start);
}

function tryChronoDateForText(text, ref) {
  const results = chrono.casual.parse(text.trim(), ref, { forwardDate: true });
  if (!results.length) return null;
  try {
    return { date: toLocalISO(results[0].start.date()), start: results[0].start };
  } catch {
    return null;
  }
}

/**
 * Prefer explicit English relatives, then chrono on fragments (dash-separated),
 * then whole string, then weekday resolver — avoids chrono mis-reading "night - in 2 days".
 */
export function extractStructuredDateTime(userInput, todayISO) {
  if (!todayISO || typeof userInput !== "string") {
    return { date: null, time: "" };
  }

  const text = userInput.trim();
  if (!text) return { date: null, time: "" };

  const ref = parseRefDate(todayISO);
  const dashParts = text.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
  const candidates = [...new Set([text, ...dashParts])];

  let date = tryExplicitRelativePatterns(text, todayISO);
  if (!date) {
    for (const part of dashParts) {
      const d = tryExplicitRelativePatterns(part, todayISO);
      if (d) {
        date = d;
        break;
      }
    }
  }

  let time = collectChronoTime(text, ref);

  if (!date) {
    for (const part of [...dashParts].reverse()) {
      const hit = tryChronoDateForText(part, ref);
      if (hit) {
        date = hit.date;
        if (!time) time = timeFromChronoStart(hit.start);
        break;
      }
    }
  }

  if (!date) {
    const hit = tryChronoDateForText(text, ref);
    if (hit) {
      date = hit.date;
      if (!time) time = timeFromChronoStart(hit.start);
    }
  }

  if (!date) {
    const wd = resolveSingleWeekdayDate(text, todayISO);
    if (wd) date = wd;
  }

  if (!date) {
    for (const part of dashParts) {
      const wd = resolveSingleWeekdayDate(part, todayISO);
      if (wd) {
        date = wd;
        break;
      }
    }
  }

  return { date, time: time || "" };
}
