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
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decisions #2/#3):
  // populated only when this comment was entered "on behalf of" someone else by an admin/team
  // leader — always visible to every team member when present (never masked, unlike
  // isAnonymous), and names the specific admin who entered it.
  postedByAdmin?: { id: number; username: string; firstName?: string | null; lastName?: string | null } | null;
}

function formatUserDisplayName(user: { username: string; firstName?: string | null; lastName?: string | null }): string {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
}

export function getCommentCategoryLabel(comment: Pick<DisplayableComment, 'category'>): string | null {
  return comment.category ? (Strings.retroBoard.categories as Record<string, string>)[comment.category] ?? null : null;
}

export function getCommentAuthorName(comment: Pick<DisplayableComment, 'isAnonymous' | 'author'>): string {
  return comment.isAnonymous
    ? Strings.retroBoard.anonymousAuthor
    : formatUserDisplayName(comment.author);
}

// Feature 9 (§9.0 decisions #2/#3, 2026-09-14 cross-feature addendum): single source of truth for
// the "posted on behalf of" indicator — shared by CommentCardWeb (comment-card-web.tsx),
// `renderCommentCard` (sprint-retro-board-native.tsx), and both memory-board card components
// (memory-card-web.tsx / memory-card-native.tsx) so all display paths for the same `Comment` stay
// in sync instead of drifting. Returns `null` when the comment wasn't posted on behalf of anyone.
export function getPostedByAdminLabel(comment: Pick<DisplayableComment, 'isAnonymous' | 'author' | 'postedByAdmin'>): string | null {
  if (!comment.postedByAdmin) return null;
  return Strings.retroBoard.postedOnBehalfIndicator(getCommentAuthorName(comment), formatUserDisplayName(comment.postedByAdmin));
}
