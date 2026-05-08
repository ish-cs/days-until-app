import { calculateDaysLeft, getEffectiveDate } from './dates.js';

export function filterEvents(events, search, colorFilter = null) {
  return events.filter(e => {
    const nameMatch = !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase());
    const colorMatch = !colorFilter || (e.bgColor || 'yellow-300') === colorFilter;
    return nameMatch && colorMatch;
  });
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
    case 'dateAdded':
      return [...sorted].sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
    default:
      return sorted.sort((a, b) => calculateDaysLeft(getEffectiveDate(a)) - calculateDaysLeft(getEffectiveDate(b)));
  }
}
