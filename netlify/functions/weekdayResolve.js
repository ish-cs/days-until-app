/** JS Sunday = 0 … Saturday = 6 — calendar arithmetic uses UTC noon so Lambda TZ doesn't skew weekdays */

/** Includes common abbreviations (Thu, Fri, Tues.) */
const WEEKDAY_TO_JS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const WEEKDAY_RE =
  /\b(?:(next|this|coming)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)\b/gi;

function normalizeWeekdayToken(tok) {
  const t = tok.toLowerCase().replace(/\.$/, "");
  const short = {
    sun: "sunday",
    mon: "monday",
    tue: "tuesday",
    tues: "tuesday",
    wed: "wednesday",
    weds: "wednesday",
    thu: "thursday",
    thur: "thursday",
    thurs: "thursday",
    fri: "friday",
    sat: "saturday",
  };
  return short[t] ?? t;
}

function parseCivilDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function formatISO(dt) {
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const da = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function addDays(dt, n) {
  const x = new Date(dt.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Soonest calendar date ≥ ref whose weekday matches targetJsDay (Sun=0). */
export function nearestWeekdayOnOrAfter(refISO, targetJsDay) {
  const ref = parseCivilDate(refISO);
  const cur = ref.getUTCDay();
  const add = (targetJsDay - cur + 7) % 7;
  return formatISO(addDays(ref, add));
}

/** English “next Tuesday”: nearest Tue + 7 days */
export function nextWeekOccurrence(refISO, targetJsDay) {
  const first = parseCivilDate(nearestWeekdayOnOrAfter(refISO, targetJsDay));
  return formatISO(addDays(first, 7));
}

function shouldSkipGrounding(text) {
  const t = text.trim();
  if (!t) return true;
  if (/\b(every|each|all)\b/i.test(t)) return true;
  if (/\b(last|past|ago)\b/i.test(t)) return true;
  if (/\d{4}-\d{2}-\d{2}/.test(t)) return true;
  if (/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(t)) return true;
  return false;
}

function extractWeekdayTokens(text) {
  const matches = [...text.matchAll(WEEKDAY_RE)];
  const out = [];
  for (const m of matches) {
    const mod = m[1]?.toLowerCase();
    const key = normalizeWeekdayToken(m[2]);
    const jsDay = WEEKDAY_TO_JS[key];
    if (jsDay === undefined) continue;
    out.push({ nextModifier: mod === "next", jsDay });
  }
  return out;
}

/** Single clear weekday mention → YYYY-MM-DD or null */
export function resolveSingleWeekdayDate(userInput, todayISO) {
  if (!todayISO || typeof userInput !== "string") return null;
  if (shouldSkipGrounding(userInput)) return null;

  const tokens = extractWeekdayTokens(userInput);
  if (tokens.length !== 1) return null;

  const { nextModifier, jsDay } = tokens[0];
  let resolved = nearestWeekdayOnOrAfter(todayISO, jsDay);
  if (nextModifier) resolved = nextWeekOccurrence(todayISO, jsDay);
  return resolved;
}
