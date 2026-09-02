import { computeSprintSummaryStats } from '../stats';
import { Strings } from '@/constants/strings';

describe('computeSprintSummaryStats', () => {
  it('returns all-zero stats for an empty comment list', () => {
    expect(computeSprintSummaryStats([])).toEqual({
      total: 0,
      keepCount: 0,
      improveCount: 0,
      byCategory: [],
    });
  });

  it('counts KEEP and IMPROVE comments separately', () => {
    const stats = computeSprintSummaryStats([
      { type: 'KEEP', category: null },
      { type: 'KEEP', category: null },
      { type: 'IMPROVE', category: null },
    ]);

    expect(stats.total).toBe(3);
    expect(stats.keepCount).toBe(2);
    expect(stats.improveCount).toBe(1);
  });

  it('groups uncategorized comments under the "no category" label', () => {
    const stats = computeSprintSummaryStats([{ type: 'KEEP', category: null }]);

    expect(stats.byCategory).toEqual([{ label: Strings.retroBoard.categoryNone, count: 1 }]);
  });

  it('groups categorized comments by their Hebrew label, merging KEEP and IMPROVE within a category', () => {
    const stats = computeSprintSummaryStats([
      { type: 'KEEP', category: 'PLANNING' },
      { type: 'IMPROVE', category: 'PLANNING' },
      { type: 'KEEP', category: 'TESTING' },
    ]);

    const planningRow = stats.byCategory.find(row => row.label === Strings.retroBoard.categories.PLANNING);
    const testingRow = stats.byCategory.find(row => row.label === Strings.retroBoard.categories.TESTING);
    expect(planningRow?.count).toBe(2);
    expect(testingRow?.count).toBe(1);
  });

  it('sorts categories by count, descending', () => {
    const stats = computeSprintSummaryStats([
      { type: 'KEEP', category: 'TESTING' },
      { type: 'KEEP', category: 'PLANNING' },
      { type: 'IMPROVE', category: 'PLANNING' },
      { type: 'IMPROVE', category: 'PLANNING' },
    ]);

    expect(stats.byCategory[0]).toEqual({ label: Strings.retroBoard.categories.PLANNING, count: 3 });
    expect(stats.byCategory[1]).toEqual({ label: Strings.retroBoard.categories.TESTING, count: 1 });
  });

  it('falls back to the raw category value if it is not a recognized label key', () => {
    const stats = computeSprintSummaryStats([{ type: 'KEEP', category: 'SOME_UNKNOWN_VALUE' }]);

    expect(stats.byCategory).toEqual([{ label: 'SOME_UNKNOWN_VALUE', count: 1 }]);
  });
});
