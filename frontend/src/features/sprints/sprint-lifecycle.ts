/**
 * Sprint lifecycle shared by the web and native sprint lists.
 *
 * `active` / `upcoming` follow the sprint dates. A sprint that has ended stays in the team's main
 * view as `recent` for RECENT_SPRINT_DAYS after its end date, and only then becomes `expired`
 * (the collapsed "ספרינטים שהסתיימו" group).
 */
export type SprintState = 'active' | 'upcoming' | 'closed';
export type SprintBucket = 'active' | 'upcoming' | 'recent' | 'expired';

export const RECENT_SPRINT_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(value: string | number | Date): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getSprintState(startDate: string, endDate: string, now: Date = new Date()): SprintState {
  const today = startOfDay(now);
  if (today >= startOfDay(startDate) && today <= startOfDay(endDate)) return 'active';
  if (today < startOfDay(startDate)) return 'upcoming';
  return 'closed';
}

/** Whole calendar days since the sprint's end date (0 on the end date itself). */
export function daysSinceEnd(endDate: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(endDate)) / MS_PER_DAY);
}

export function getSprintBucket(startDate: string, endDate: string, now: Date = new Date()): SprintBucket {
  const state = getSprintState(startDate, endDate, now);
  if (state !== 'closed') return state;
  return daysSinceEnd(endDate, now) <= RECENT_SPRINT_DAYS ? 'recent' : 'expired';
}

/** Whole calendar days until the sprint starts (1 = tomorrow). Only meaningful for `upcoming`. */
export function daysUntilStart(startDate: string, now: Date = new Date()): number {
  return Math.round((startOfDay(startDate) - startOfDay(now)) / MS_PER_DAY);
}

/** Which day of an active sprint today is ("יום 11 מתוך 15"), plus the matching percentage. */
export function getSprintProgress(startDate: string, endDate: string, now: Date = new Date()) {
  const total = Math.round((startOfDay(endDate) - startOfDay(startDate)) / MS_PER_DAY) + 1;
  const elapsed = Math.round((startOfDay(now) - startOfDay(startDate)) / MS_PER_DAY) + 1;
  const day = Math.min(Math.max(elapsed, 1), total);
  return { day, total, percent: Math.round((day / total) * 100) };
}
