import { Strings } from '@/constants/strings';
import {
  assigneeChoices, defaultSprintId, draftTextFromComment, formatScore, historyLine, MAX_POINT_TEXT, trendLabel, windowLabel,
} from '../focus-points-logic';
import type { HistoryEntry } from '../types';

const S = Strings.focusPoints;
const entry = (o: Partial<HistoryEntry>): HistoryEntry => ({
  sprintId: 1, sprintName: 'ספרינט 1', endedAt: '2026-01-14T23:59:59.999Z', closed: true, raterCount: 4, average: 3.8, valid: true, trend: 'IMPROVED', ...o,
});

describe('focus-points-logic', () => {
  it('formatScore: one decimal, dash for none', () => {
    expect(formatScore(4.75)).toBe('4.8');
    expect(formatScore(3)).toBe('3');
    expect(formatScore(null)).toBe('—');
  });

  it('trend and window labels', () => {
    expect(trendLabel('IMPROVED')).toBe(S.trendImproved);
    expect(trendLabel('DECLINED')).toBe(S.trendDeclined);
    expect(trendLabel('SAME')).toBe(S.trendSame);
    expect(trendLabel(null)).toBeNull();
    expect(windowLabel('OPEN')).toBe(S.windowOpen);
    expect(windowLabel('CLOSED')).toBe(S.windowClosed);
    expect(windowLabel('NOT_OPEN')).toBe(S.windowNotOpen);
  });

  describe('historyLine', () => {
    it('shows average, raters and trend for a valid closed sprint', () => {
      expect(historyLine(entry({}), false)).toBe(`ספרינט 1: 3.8 · ${S.ratersCount(4)} · ${S.trendImproved}`);
    });
    it('says the window is still open instead of leaking a partial result', () => {
      expect(historyLine(entry({ closed: false, average: null, valid: false }), false)).toBe(`ספרינט 1: ${S.windowStillOpen}`);
    });
    it('explains a missing result: too few raters, or a team too small', () => {
      expect(historyLine(entry({ valid: false, average: null, trend: null }), false)).toBe(`ספרינט 1: ${S.scoreNotEnoughRatings}`);
      expect(historyLine(entry({}), true)).toBe(`ספרינט 1: ${S.scoreHiddenSmallTeam}`);
    });
  });

  it('draftTextFromComment trims and caps at the backend limit', () => {
    expect(draftTextFromComment('  שלום \n')).toBe('שלום');
    const long = draftTextFromComment('א'.repeat(MAX_POINT_TEXT + 20));
    expect(long).toHaveLength(MAX_POINT_TEXT);
    expect(long.endsWith('…')).toBe(true);
  });

  it('assigneeChoices: active real members only, by display name', () => {
    const members = [
      { userId: 1, status: 'ACTIVE', user: { username: 'a', firstName: 'דנה', lastName: 'לוי' } },
      { userId: 2, status: 'PENDING', user: { username: 'b' } },
      { userId: 3, status: 'ACTIVE', user: { username: 'ghost', isPhantom: true } },
      { userId: 4, user: { username: 'c' } },
    ];
    expect(assigneeChoices(members)).toEqual([{ userId: 1, label: 'דנה לוי' }, { userId: 4, label: 'c' }]);
    expect(assigneeChoices(undefined)).toEqual([]);
  });

  it('defaultSprintId picks the most recently started sprint', () => {
    expect(defaultSprintId([])).toBeNull();
    expect(defaultSprintId([{ id: 1, startDate: '2026-01-01' }, { id: 2, startDate: '2026-03-01' }, { id: 3, startDate: '2026-02-01' }])).toBe(2);
  });
});
