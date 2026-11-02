import { ForbiddenException } from '@nestjs/common';
import { israelDayAnchor } from '../common/israel-day';

// Feature 13 (product-backlog/13-comment-edit-delete.md §13.0): ONE write window for writing,
// editing and deleting a comment. A sprint is "open for writing" before it starts, while it runs,
// and for WRITE_WINDOW_DAYS calendar days after its end date — the same period the sprint stays in
// the team's main list (frontend `RECENT_SPRINT_DAYS`, features/sprints/sprint-lifecycle.ts). After
// that the board is locked, unless an admin opened a per-user extension (SprintWriteExtension).
//
// Keep WRITE_WINDOW_DAYS equal to the frontend's RECENT_SPRINT_DAYS.
export const WRITE_WINDOW_DAYS = 3;

export const SPRINT_LOCKED_MESSAGE = 'הלוח נעול לכתיבה — הספרינט הסתיים';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Thrown when a write is attempted on a locked sprint. The Telegram bot matches on this class. */
export class SprintLockedException extends ForbiddenException {
  constructor() {
    super(SPRINT_LOCKED_MESSAGE);
  }
}

/** Midnight UTC of the calendar date a sprint date column holds. */
function dayOf(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** True while the sprint is inside the common write window (no extension considered). */
export function isWithinWriteWindow(sprint: { endDate: Date }, now: Date = new Date()): boolean {
  const lastWritableDay = dayOf(sprint.endDate) + WRITE_WINDOW_DAYS * MS_PER_DAY;
  return israelDayAnchor(now).getTime() <= lastWritableDay;
}

export type WriteExtensionLike = { userId: number; expiresAt: Date };

/** The latest still-active extension of `userId` (expiresAt in the future), or null. */
export function activeExtensionFor(
  extensions: readonly WriteExtensionLike[],
  userId: number,
  now: Date = new Date()
): WriteExtensionLike | null {
  let best: WriteExtensionLike | null = null;
  for (const ext of extensions) {
    if (ext.userId !== userId || ext.expiresAt.getTime() <= now.getTime()) continue;
    if (!best || ext.expiresAt.getTime() > best.expiresAt.getTime()) best = ext;
  }
  return best;
}

/** In the common window, or the user holds an active extension. */
export function isSprintWritable(
  sprint: { endDate: Date },
  userId: number,
  now: Date = new Date(),
  extensions: readonly WriteExtensionLike[] = []
): boolean {
  return isWithinWriteWindow(sprint, now) || activeExtensionFor(extensions, userId, now) !== null;
}
