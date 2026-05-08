/**
 * Resolve phrases like "a day after my bday" or "2 weeks after dog walk"
 * using the user's existing calendar events (names + dates + recurrence).
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISO(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function addCalendarDays(baseISO, deltaDays) {
  const [y, m, d] = baseISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/** Next calendar date for yearly recurrence (month/day from anchor) on or after todayISO. */
function nextYearlyOccurrence(anchorDateStr, todayISO) {
  const [, am, ad] = anchorDateStr.split("-").map(Number);
  const [ty] = todayISO.split("-").map(Number);
  let cand = toISO(ty, am, ad);
  if (cand < todayISO) cand = toISO(ty + 1, am, ad);
  return cand;
}

/** Next occurrence of monthly anchor (same day-of-month) on or after todayISO. */
function nextMonthlyOccurrence(anchorDateStr, todayISO) {
  const [, am, ad] = anchorDateStr.split("-").map(Number);
  const [ty, tm] = todayISO.split("-").map(Number);
  let y = ty;
  let mo = tm;
  for (let guard = 0; guard < 40; guard++) {
    const last = new Date(y, mo, 0).getDate();
    const day = Math.min(ad, last);
    const cand = toISO(y, mo, day);
    if (cand >= todayISO) return cand;
    mo += 1;
    if (mo > 12) {
      mo = 1;
      y += 1;
    }
  }
  return null;
}

/** Same weekday as anchor; next date on or after todayISO (local calendar). */
function nextWeeklyOccurrence(anchorDateStr, todayISO) {
  const [ay, am, ad] = anchorDateStr.split("-").map(Number);
  const want = new Date(ay, am - 1, ad).getDay();
  const [ty, tm, td] = todayISO.split("-").map(Number);
  let d = new Date(ty, tm - 1, td);
  for (let i = 0; i < 400; i++) {
    if (d.getDay() === want) {
      const iso = toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
      if (iso >= todayISO) return iso;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/**
 * Next instance of `event` on or after user's `todayISO` (YYYY-MM-DD, client calendar).
 */
export function nextInstanceOnOrAfter(event, todayISO) {
  if (!event?.date || !todayISO) return null;
  const dateStr = String(event.date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const rec = event.recurrence || null;

  if (!rec) {
    return dateStr >= todayISO ? dateStr : null;
  }
  if (rec === "yearly") {
    return nextYearlyOccurrence(dateStr, todayISO);
  }
  if (rec === "monthly") {
    return nextMonthlyOccurrence(dateStr, todayISO);
  }
  if (rec === "weekly") {
    return nextWeeklyOccurrence(dateStr, todayISO);
  }
  return dateStr >= todayISO ? dateStr : null;
}

function stripRefNoise(phrase) {
  return phrase
    .replace(/\s+/g, " ")
    .replace(/\s*[,;]\s*$/, "")
    .trim();
}

/** Expand spoken refs ("bday") for matching event titles ("Birthday"). */
function refVariants(refNorm) {
  const base = refNorm
    .replace(/^(?:my|the|a|an|their|his|her|our)\s+/i, "")
    .trim();
  const set = new Set();
  if (base) set.add(base);
  if (/\bbday\b|\bb-day\b/i.test(refNorm) || /\bbday\b|\bb-day\b/i.test(base)) {
    const ex = (base || refNorm).replace(/\bb-day\b/gi, "birthday").replace(/\bbday\b/gi, "birthday");
    set.add(ex);
    set.add("birthday");
  }
  return [...set].filter(Boolean);
}

function normalizeTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(refPhrase, eventName) {
  const refn = normalizeTitle(refPhrase);
  if (!refn) return 0;
  const ev = normalizeTitle(eventName);
  if (!ev) return 0;

  for (const v of refVariants(refn)) {
    if (!v) continue;
    if (ev === v) return 100;
    if (ev.includes(v) || v.includes(ev)) return 85;
    const vtokens = v.split(" ").filter((t) => t.length > 1);
    const etokens = ev.split(" ").filter(Boolean);
    if (!vtokens.length) continue;
    let hit = 0;
    for (const t of vtokens) {
      if (etokens.some((e) => e === t || e.startsWith(t) || t.startsWith(e))) hit++;
    }
    if (hit === vtokens.length) return 75;
    if (hit > 0) return 55 + hit;
  }
  return 0;
}

function pickBestEvent(refPhrase, events) {
  let best = null;
  let bestScore = 0;
  for (const e of events) {
    const name = String(e.name ?? "").replace(/[\r\n]/g, " ").slice(0, 120);
    const sc = scoreMatch(refPhrase, name);
    if (sc > bestScore) {
      bestScore = sc;
      best = e;
    } else if (sc === bestScore && sc > 0 && best) {
      const na = String(best.name ?? "");
      const nb = name;
      if (nb.length < na.length) best = e;
    }
  }
  return bestScore >= 55 ? best : null;
}

const STOP_BEFORE = '(?=\\s+(?:every\\s+(?:year|week|month)|weekly|monthly|yearly)\\b|[,;]|$)';

/**
 * Parse "{N} days/weeks after|before {ref}" (also a/the/one day/week).
 * @returns {{ deltaDays: number, refPhrase: string } | null}
 */
export function parseRelativeOffsetClause(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;

  const weekRe = new RegExp(
    `\\b(?:(\\d+)\\s+weeks?|(?:a|an|one|the|1)\\s+week)\\s+(after|before)\\s+(.+?)${STOP_BEFORE}`,
    "i"
  );
  const dayRe = new RegExp(
    `\\b(?:(\\d+)\\s+days?|(?:a|an|one|the|1)\\s+day)\\s+(after|before)\\s+(.+?)${STOP_BEFORE}`,
    "i"
  );

  let m = t.match(weekRe);
  if (m) {
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const sign = m[2].toLowerCase() === "before" ? -1 : 1;
    return { deltaDays: sign * n * 7, refPhrase: stripRefNoise(m[3]) };
  }

  m = t.match(dayRe);
  if (m) {
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const sign = m[2].toLowerCase() === "before" ? -1 : 1;
    return { deltaDays: sign * n, refPhrase: stripRefNoise(m[3]) };
  }

  return null;
}

/**
 * If the user anchors the date to an existing event, return { date } ISO string; else null.
 */
export function tryEventAnchoredDate(userInput, todayISO, rawEvents) {
  if (!todayISO || !userInput || !Array.isArray(rawEvents) || rawEvents.length === 0) {
    return null;
  }

  const clause = parseRelativeOffsetClause(userInput);
  if (!clause?.refPhrase) return null;

  const events = rawEvents
    .filter((e) => e && e.name && e.date)
    .map((e) => ({
      name: e.name,
      date: String(e.date).slice(0, 10),
      recurrence: e.recurrence ?? null,
    }));

  const match = pickBestEvent(clause.refPhrase, events);
  if (!match) return null;

  const anchor = nextInstanceOnOrAfter(match, todayISO);
  if (!anchor) return null;

  const resolved = addCalendarDays(anchor, clause.deltaDays);
  return { date: resolved };
}
