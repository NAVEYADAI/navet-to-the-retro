import {
  averageOf, buildHistory, canShowResults, reachedGoal, summarizeSprintRatings, trendBetween,
} from './focus-point-score';

describe('focus-point-score', () => {
  describe('canShowResults / summarizeSprintRatings (#15, #19)', () => {
    it('needs at least 3 raters AND a team of at least 3 active members', () => {
      expect(canShowResults(5, 3)).toBe(true);
      expect(canShowResults(5, 2)).toBe(false);
      expect(canShowResults(2, 3)).toBe(false);
      expect(canShowResults(3, 3)).toBe(true);
    });

    it('hides the average when not valid but still reports the rater count', () => {
      expect(summarizeSprintRatings([5, 4], 6)).toEqual({ raterCount: 2, valid: false, average: null });
      const ok = summarizeSprintRatings([5, 4, 3], 6);
      expect(ok.valid).toBe(true);
      expect(ok.average).toBe(averageOf([5, 4, 3]));
    });
  });

  describe('reachedGoal (#16)', () => {
    it('closes from an average of 4.5 and up', () => {
      expect(reachedGoal(4.5)).toBe(true);
      expect(reachedGoal(4.49)).toBe(false);
      expect(reachedGoal(5)).toBe(true);
    });
  });

  describe('trendBetween (#17)', () => {
    it('counts a change of at least 10% of the scale (0.5)', () => {
      expect(trendBetween(2, 3, 4)).toBe('IMPROVED');
      expect(trendBetween(3, 2.5, 4)).toBe('DECLINED');
      expect(trendBetween(3, 3.4, 4)).toBe('SAME');
    });

    it('ignores a change that one rater moving one point would cause', () => {
      // 3 raters: one point = 0.333 < 0.5, so even a full single step is noise
      expect(trendBetween(3, 3.333, 3)).toBe('SAME');
      // a comparable jump with only 2 raters would exceed it, but 2 raters is never "valid" anyway
      expect(trendBetween(3, 3.5, 2)).toBe('SAME');
    });
  });

  describe('buildHistory (#18, #29)', () => {
    const valid = (avg: number, n = 4) => ({ raterCount: n, average: avg, valid: true });
    const invalid = { raterCount: 1, average: null, valid: false };

    it('measures the first valid sprint against the starting score', () => {
      const { entries, currentScore } = buildHistory(2, [valid(3.2)]);
      expect(entries[0].trend).toBe('IMPROVED');
      expect(currentScore).toBe(3.2);
    });

    it('skips an invalid sprint without moving the baseline', () => {
      const { entries, currentScore } = buildHistory(2, [valid(3), invalid, valid(3.1)]);
      expect(entries.map((e) => e.trend)).toEqual(['IMPROVED', null, 'SAME']);
      expect(entries[1]).toMatchObject({ valid: false, average: null });
      expect(currentScore).toBe(3.1);
    });

    it('falls back to the starting score when no sprint has a valid rating', () => {
      expect(buildHistory(3, [invalid]).currentScore).toBe(3);
    });
  });
});
