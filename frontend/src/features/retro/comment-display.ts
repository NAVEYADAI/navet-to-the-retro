import { Strings } from '@/constants/strings';

/**
 * Shared field derivation for "how does a Comment display" — used by CommentCardWeb
 * (comment-card-web.tsx), `renderCommentCard` (sprint-retro-board-native.tsx), and the memory-game
 * card components (memory-card-web.tsx / memory-card-native.tsx, product-backlog/08-memory-board.md §8) so the
 * category-label/author-name logic has a single source instead of four copies drifting apart.
 */
export interface DisplayableComment {
  category?: string | null;
  isAnonymous: boolean;
  author: { username: string; firstName?: string | null; lastName?: string | null };
}

export function getCommentCategoryLabel(comment: Pick<DisplayableComment, 'category'>): string | null {
  return comment.category ? (Strings.retroBoard.categories as Record<string, string>)[comment.category] ?? null : null;
}

export function getCommentAuthorName(comment: Pick<DisplayableComment, 'isAnonymous' | 'author'>): string {
  return comment.isAnonymous
    ? Strings.retroBoard.anonymousAuthor
    : `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.username;
}
