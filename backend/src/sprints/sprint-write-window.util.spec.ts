import {
  isWithinWriteWindow,
  activeExtensionFor,
  isSprintWritable,
  SprintLockedException,
  WRITE_WINDOW_DAYS,
} from './sprint-write-window.util';

// Sprint dates are stored as midnight UTC of the calendar day the user picked.
const sprint = { endDate: new Date('2026-10-05T00:00:00.000Z') };

describe('sprint write window (feature 13)', () => {
  it('uses the same number of days as the frontend RECENT_SPRINT_DAYS', () => {
    expect(WRITE_WINDOW_DAYS).toBe(3);
  });

  describe('isWithinWriteWindow', () => {
    it('is open before the sprint, during it and on its last day', () => {
      expect(isWithinWriteWindow(sprint, new Date('2026-09-01T10:00:00Z'))).toBe(true);
      expect(isWithinWriteWindow(sprint, new Date('2026-10-05T10:00:00Z'))).toBe(true);
    });

    it('stays open through the 3rd day after the end date (Israel time)', () => {
      expect(isWithinWriteWindow(sprint, new Date('2026-10-08T10:00:00Z'))).toBe(true);
      // 20:59:59 UTC Oct 8 = 23:59:59 Israel — still day 3.
      expect(isWithinWriteWindow(sprint, new Date('2026-10-08T20:59:59Z'))).toBe(true);
    });

    it('locks on the 4th day, counted in Israel time', () => {
      // 21:00:00 UTC Oct 8 = 00:00:00 Oct 9 in Israel.
      expect(isWithinWriteWindow(sprint, new Date('2026-10-08T21:00:00Z'))).toBe(false);
      expect(isWithinWriteWindow(sprint, new Date('2026-10-09T10:00:00Z'))).toBe(false);
    });
  });

  describe('activeExtensionFor / isSprintWritable', () => {
    const now = new Date('2026-10-20T10:00:00Z');
    const future = new Date('2026-10-22T00:00:00Z');
    const past = new Date('2026-10-19T00:00:00Z');

    it('an active extension of the user reopens a locked sprint', () => {
      expect(isSprintWritable(sprint, 7, now, [{ userId: 7, expiresAt: future }])).toBe(true);
    });

    it('an expired extension does not', () => {
      expect(isSprintWritable(sprint, 7, now, [{ userId: 7, expiresAt: past }])).toBe(false);
    });

    it('an extension of someone else does not', () => {
      expect(isSprintWritable(sprint, 7, now, [{ userId: 8, expiresAt: future }])).toBe(false);
    });

    it('picks the latest active extension', () => {
      const later = new Date('2026-10-25T00:00:00Z');
      expect(activeExtensionFor([{ userId: 7, expiresAt: future }, { userId: 7, expiresAt: later }], 7, now)?.expiresAt).toEqual(later);
    });

    it('no extension needed inside the window', () => {
      expect(isSprintWritable(sprint, 7, new Date('2026-10-06T10:00:00Z'))).toBe(true);
    });
  });

  it('SprintLockedException is a 403 with a Hebrew message', () => {
    const e = new SprintLockedException();
    expect(e.getStatus()).toBe(403);
    expect(e.message).toContain('נעול');
  });
});
