// BUG-58: a single date/time formatter for the whole app. Before this, sprint screens used the
// bare `toLocaleDateString()` (browser locale, "9/28/2026" in en-US) while the length-history
// panel and comment cards used 'he-IL' ("28.9.2026").
const LOCALE = 'he-IL';

export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(LOCALE);
}

export function formatTime(value: string | number | Date): string {
  return new Date(value).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateRange(start: string | number | Date, end: string | number | Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}
