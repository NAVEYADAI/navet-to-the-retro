import type { DisplayableComment } from './comment-display';

/**
 * Feature 13 (product-backlog/13-comment-edit-delete.md): the shapes the edit/delete UI shares
 * between the web and native boards. The board's own comment list is still loosely typed (`any[]`)
 * — these describe only what feature 13 reads from it.
 */
export type CommentColumn = 'KEEP' | 'IMPROVE';

/** A comment as `GET /sprints/:id/comments` returns it (the server decides isMine / canEdit / canDelete). */
export interface BoardComment extends DisplayableComment {
  id: number;
  content: string;
  type: CommentColumn;
  categoryId?: number | null;
  isHighlighted?: boolean;
  createdAt: string;
  /** Set once the comment was really changed (content, column or category) — drives the "נערכה" label. */
  updatedAt?: string | null;
  isMine?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

/** `PATCH /comments/:id` body — only fields that changed (never `isAnonymous`). */
export interface CommentPatch {
  content?: string;
  type?: CommentColumn;
  categoryId?: number | null;
}

/** The server rejects a comment longer than this (400); the textareas stop typing at the same cap. */
export const COMMENT_MAX_LENGTH = 2000;

/** `GET /sprints/:id/write-access`. */
export interface WriteAccess {
  canWrite: boolean;
  windowOpen: boolean;
  windowDays: number;
  extensionExpiresAt: string | null;
  /** False on a locked board that only an extension keeps open (the timestamps would identify the writer). Absent = true. */
  anonymousAllowed?: boolean;
}

export interface MemberRef {
  id: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
}

/** `GET /sprints/:id/write-extensions` (an admin gets everyone's active ones). */
export interface WriteExtension {
  id: number;
  sprintId: number;
  userId: number;
  expiresAt: string;
  user: MemberRef;
}

/** `GET /sprints/:id/comments/deleted` (admin only). `deletedBy` is null when the anonymous author deleted it. */
export interface DeletedComment extends BoardComment {
  deletedAt: string;
  deletedBy: MemberRef | null;
  deletedByAuthor: boolean;
}

/** A category the edit form may offer: the team's enabled ones, plus the comment's own even if since disabled. */
export interface CategoryOption {
  value: string;
  label: string;
}
