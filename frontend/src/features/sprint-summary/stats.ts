import { Strings } from '@/constants/strings';
import { getCommentCategoryLabel } from '@/features/retro/comment-display';

export interface SprintSummaryStats {
  total: number;
  keepCount: number;
  improveCount: number;
  byCategory: Array<{ label: string; count: number }>;
}

export function computeSprintSummaryStats(comments: any[]): SprintSummaryStats {
  const counts = new Map<string, number>();
  let keepCount = 0;
  let improveCount = 0;

  for (const comment of comments) {
    if (comment.type === 'KEEP') keepCount += 1;
    if (comment.type === 'IMPROVE') improveCount += 1;

    // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.1):
    // the API now returns `category` as the joined `{ id, label }` relation (or null), not the
    // old enum string — this was previously read via Strings.retroBoard.categories[comment.category]
    // directly, which broke (rendered "[object Object]"/crashed React) the moment the backend
    // migration shipped. Reuse the same shared derivation the comment cards use instead of
    // re-deriving it a second, now-stale way.
    const label = getCommentCategoryLabel(comment) ?? Strings.retroBoard.categoryNone;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const byCategory = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { total: comments.length, keepCount, improveCount, byCategory };
}
