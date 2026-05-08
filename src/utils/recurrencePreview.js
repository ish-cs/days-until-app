export function detectRecurrencePreview(text) {
  const t = text.toLowerCase();
  if (/\bevery\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(t) ||
      /\bweekly\b/.test(t) ||
      /\beach\s+\w+day\b/.test(t) ||
      /\bevery other week\b/.test(t)) return 'weekly';
  if (/\bevery\s+month\b/.test(t) ||
      /\bmonthly\b/.test(t) ||
      /\beach month\b/.test(t) ||
      /\bfirst of every month\b/.test(t)) return 'monthly';
  if (/\bevery\s+year\b/.test(t) ||
      /\bannually\b/.test(t) ||
      /\byearly\b/.test(t)) return 'yearly';
  return null;
}
