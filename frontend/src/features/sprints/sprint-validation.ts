import { Strings } from '@/constants/strings';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * BUG-12 (frontend part): a sprint may not end before it starts. Equal dates (one-day sprint)
 * are allowed — mirrors the backend's assertValidDateRange. Returns a Hebrew error message, or
 * null when the range is fine (or not comparable yet — emptiness is the caller's own check).
 */
export function validateSprintDateRange(startDate: string, endDate: string): string | null {
  const start = startDate.trim();
  const end = endDate.trim();
  if (!start || !end) return null;
  // <input type="date"> yields YYYY-MM-DD, which sorts lexicographically; anything else falls
  // back to Date parsing, and unparseable values are left for the server to reject.
  if (ISO_DAY.test(start) && ISO_DAY.test(end)) {
    return end < start ? Strings.sprints.endBeforeStartError : null;
  }
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return endMs < startMs ? Strings.sprints.endBeforeStartError : null;
}

/**
 * Create-form check: both dates must be readable by `new Date()` (the same test the backend's
 * parseDateString applies, which answers 400 "תאריך לא תקין"), and then the range check above
 * applies. Callers check emptiness first. Returns a Hebrew error message or null.
 */
export function validateSprintDates(startDate: string, endDate: string): string | null {
  const start = startDate.trim();
  const end = endDate.trim();
  if (Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime())) {
    return Strings.sprints.invalidDateError;
  }
  return validateSprintDateRange(start, end);
}

/**
 * Message to show for a failed sprint request. Nest answers validation failures with a string or
 * an array of strings in `response.data.message` — arrays are joined into one line. Falls back to
 * the transport error message and then to `fallback`.
 */
export function getSprintApiErrorMessage(err: any, fallback: string): string {
  const raw = err?.response?.data?.message;
  const serverMessage = Array.isArray(raw) ? raw.filter((m) => typeof m === 'string').join(' ') : raw;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
  return err?.message || fallback;
}
