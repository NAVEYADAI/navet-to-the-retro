import { LIVE_SPRINT, LIVE_TEAM, SOFT_DELETE_RETENTION_DAYS, daysLeftToRestore, isDeleted, isRestorable, purgeCutoff } from './soft-delete';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-13T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

describe('soft-delete helpers (feature 14)', () => {
  it('isDeleted is false for live, missing and undefined rows', () => {
    expect(isDeleted({ deletedAt: null })).toBe(false);
    expect(isDeleted({})).toBe(false);
    expect(isDeleted(null)).toBe(false);
    expect(isDeleted(undefined)).toBe(false);
    expect(isDeleted({ deletedAt: new Date() })).toBe(true);
  });

  it('live filters exclude a deleted sprint AND a sprint of a deleted team', () => {
    expect(LIVE_TEAM).toEqual({ deletedAt: null });
    expect(LIVE_SPRINT).toEqual({ deletedAt: null, team: { deletedAt: null } });
  });

  it('retention is 30 days: a row deleted 29 days ago is restorable, one deleted 31 days ago is not', () => {
    expect(SOFT_DELETE_RETENTION_DAYS).toBe(30);
    expect(isRestorable(daysAgo(29), now)).toBe(true);
    expect(isRestorable(daysAgo(31), now)).toBe(false);
    expect(isRestorable(null, now)).toBe(false);
  });

  it('purgeCutoff is exactly 30 days back', () => {
    expect(purgeCutoff(now).getTime()).toBe(daysAgo(30).getTime());
  });

  it('daysLeftToRestore counts down to 0 and never goes negative', () => {
    expect(daysLeftToRestore(daysAgo(0), now)).toBe(30);
    expect(daysLeftToRestore(daysAgo(10), now)).toBe(20);
    expect(daysLeftToRestore(daysAgo(29.5), now)).toBe(1);
    expect(daysLeftToRestore(daysAgo(30), now)).toBe(0);
    expect(daysLeftToRestore(daysAgo(45), now)).toBe(0);
  });
});
