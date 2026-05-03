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
 * Prefer chrono (casual EN + forward from reference day).
 * Fallback: single weekday phrase resolver (incl. abbreviations).
 */
export function extractStructuredDateTime(userInput, todayISO) {
  if (!todayISO || typeof userInput !== "string") {
    return { date: null, time: "" };
  }

  const text = userInput.trim();
  if (!text) return { date: null, time: "" };

  const ref = parseRefDate(todayISO);

  const results = chrono.casual.parse(text, ref, { forwardDate: true });

  if (results.length > 0) {
    try {
      const first = results[0];
      const date = toLocalISO(first.start.date());
      const time = timeFromChronoStart(first.start);
      return { date, time };
    } catch {
      /* weekday fallback */
    }
  }

  const wd = resolveSingleWeekdayDate(text, todayISO);
  if (wd) return { date: wd, time: "" };

  return { date: null, time: "" };
}
