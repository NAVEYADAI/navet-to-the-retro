import { Strings } from '@/constants/strings';

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

    const label = comment.category
      ? (Strings.retroBoard.categories[comment.category] ?? comment.category)
      : Strings.retroBoard.categoryNone;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const byCategory = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { total: comments.length, keepCount, improveCount, byCategory };
}
