// Feature 14 (product-backlog/14-sprint-and-team-deletion.md): sprints and teams are soft-deleted
// (`deletedAt`) and restorable for 30 days; after that a purge removes them for good.
//
// A deleted team or sprint "does not exist" for the rest of the system (§14.0 technical default
// #1): every lookup answers 404, no list shows it, the Telegram bot and the calendar sync ignore
// it. Services use the small helpers below at each lookup instead of one global Prisma filter, so
// the restore / "deleted" paths can still see deleted rows deliberately.

export const SOFT_DELETE_RETENTION_DAYS = 30;
export const SOFT_DELETE_RETENTION_MS = SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type MaybeDeleted = { deletedAt?: Date | null } | null | undefined;

/** True for a team/sprint that is soft-deleted. `undefined`/`null` rows are "not deleted" here. */
export function isDeleted(row: MaybeDeleted): boolean {
  return !!row?.deletedAt;
}

/** `where` fragment for a Sprint query: not deleted itself, and its team isn't deleted either. */
export const LIVE_SPRINT = { deletedAt: null, team: { deletedAt: null } } as const;

/** `where` fragment for a Team query. */
export const LIVE_TEAM = { deletedAt: null } as const;

/** The moment before which a soft-deleted row is past the retention window and may be purged. */
export function purgeCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - SOFT_DELETE_RETENTION_MS);
}

/** Whole days left to restore a row deleted at `deletedAt` (0 on the last day, never negative). */
export function daysLeftToRestore(deletedAt: Date, now: Date = new Date()): number {
  const remaining = deletedAt.getTime() + SOFT_DELETE_RETENTION_MS - now.getTime();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

/** True while a soft-deleted row can still be restored. */
export function isRestorable(deletedAt: Date | null | undefined, now: Date = new Date()): boolean {
  return !!deletedAt && deletedAt.getTime() > purgeCutoff(now).getTime();
}
