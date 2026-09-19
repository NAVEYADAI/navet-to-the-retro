import { computeSprintSummaryStats } from '../stats';
import { Strings } from '@/constants/strings';

// Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.1): the
// API's `category` field is now the joined `{ id, label }` relation (or null), not the old
// `CommentCategory` enum string — these fixtures match that shape.
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

  it('groups categorized comments by their joined label, merging KEEP and IMPROVE within a category', () => {
    const stats = computeSprintSummaryStats([
      { type: 'KEEP', category: { id: 1, label: Strings.retroBoard.categories.PLANNING } },
      { type: 'IMPROVE', category: { id: 1, label: Strings.retroBoard.categories.PLANNING } },
      { type: 'KEEP', category: { id: 2, label: Strings.retroBoard.categories.TESTING } },
    ]);

    const planningRow = stats.byCategory.find(row => row.label === Strings.retroBoard.categories.PLANNING);
    const testingRow = stats.byCategory.find(row => row.label === Strings.retroBoard.categories.TESTING);
    expect(planningRow?.count).toBe(2);
    expect(testingRow?.count).toBe(1);
  });

  it('sorts categories by count, descending', () => {
    const stats = computeSprintSummaryStats([
      { type: 'KEEP', category: { id: 2, label: Strings.retroBoard.categories.TESTING } },
      { type: 'KEEP', category: { id: 1, label: Strings.retroBoard.categories.PLANNING } },
      { type: 'IMPROVE', category: { id: 1, label: Strings.retroBoard.categories.PLANNING } },
      { type: 'IMPROVE', category: { id: 1, label: Strings.retroBoard.categories.PLANNING } },
    ]);

    expect(stats.byCategory[0]).toEqual({ label: Strings.retroBoard.categories.PLANNING, count: 3 });
    expect(stats.byCategory[1]).toEqual({ label: Strings.retroBoard.categories.TESTING, count: 1 });
  });

  it('uses a disabled/custom category label exactly as joined, even if it is not one of the default seed labels', () => {
    const stats = computeSprintSummaryStats([{ type: 'KEEP', category: { id: 99, label: 'קטגוריה מותאמת אישית' } }]);

    expect(stats.byCategory).toEqual([{ label: 'קטגוריה מותאמת אישית', count: 1 }]);
  });
});
