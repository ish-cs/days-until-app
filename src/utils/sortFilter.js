import { calculateDaysLeft, getEffectiveDate } from './dates.js';

export function filterEvents(events, search) {
  const q = search.trim().toLowerCase();
  if (!q) return events;
  return events.filter(e => e.name.toLowerCase().includes(q));
}

export function sortEvents(events, order) {
  const sorted = [...events];
  switch (order) {
    case 'latest':
      return sorted.sort((a, b) => calculateDaysLeft(getEffectiveDate(b)) - calculateDaysLeft(getEffectiveDate(a)));
    case 'az':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'za':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return sorted.sort((a, b) => calculateDaysLeft(getEffectiveDate(a)) - calculateDaysLeft(getEffectiveDate(b)));
  }
}
