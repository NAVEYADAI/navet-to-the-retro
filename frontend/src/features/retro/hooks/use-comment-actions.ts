import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import type { BoardComment, CommentPatch } from '../comment-types';

interface Params {
  token: string;
  /** Called with the server's copy of an edited comment (same shape as a board comment). */
  onUpdated: (comment: BoardComment) => void;
  /** Called after a successful soft delete. */
  onDeleted: (commentId: number) => void;
}

/**
 * Feature 13 (product-backlog/13-comment-edit-delete.md §13.2) — edit / delete one comment at a time,
 * inline in its card. Shared by the web and native boards; only the presentation differs. Nothing here
 * refetches: the board patches its own list from `onUpdated` / `onDeleted`.
 */
export function useCommentActions({ token, onUpdated, onDeleted }: Params) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // The error belongs to the card it happened on, so other cards don't show it.
  const [error, setError] = useState<{ id: number; message: string } | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const startEdit = useCallback((comment: BoardComment) => {
    trackEvent('comment_edit_opened', { type: comment.type });
    setError(null);
    setDeletingId(null);
    setEditingId(comment.id);
  }, []);

  const cancelEdit = useCallback(() => {
    trackEvent('comment_edit_cancelled');
    setError(null);
    setEditingId(null);
  }, []);

  /** Resolves true when the edit is done (saved, or there was nothing to save). */
  const saveEdit = useCallback(async (comment: BoardComment, patch: CommentPatch): Promise<boolean> => {
    if (Object.keys(patch).length === 0) {
      setEditingId(null);
      return true;
    }
    setError(null);
    setBusy(true);
    try {
      const response = await axios.patch(`${getBackendUrl()}/comments/${comment.id}`, patch, { headers });
      trackEvent('comment_edited', {
        contentChanged: patch.content !== undefined,
        columnChanged: patch.type !== undefined,
        categoryChanged: patch.categoryId !== undefined,
      });
      onUpdated(response.data);
      setEditingId(null);
      return true;
    } catch (err: any) {
      setError({ id: comment.id, message: err?.response?.data?.message || Strings.retroBoard.editError });
      return false;
    } finally {
      setBusy(false);
    }
  }, [headers, onUpdated]);

  const askDelete = useCallback((comment: BoardComment) => {
    // Deleting someone else's comment is moderation (admin only) — worth telling apart in analytics.
    trackEvent('comment_delete_clicked', { moderation: comment.isMine === false });
    setError(null);
    setEditingId(null);
    setDeletingId(comment.id);
  }, []);

  const cancelDelete = useCallback(() => {
    trackEvent('comment_delete_cancelled');
    setError(null);
    setDeletingId(null);
  }, []);

  const confirmDelete = useCallback(async (comment: BoardComment) => {
    setError(null);
    setBusy(true);
    try {
      await axios.delete(`${getBackendUrl()}/comments/${comment.id}`, { headers });
      trackEvent('comment_deleted', { moderation: comment.isMine === false });
      setDeletingId(null);
      onDeleted(comment.id);
    } catch (err: any) {
      setError({ id: comment.id, message: err?.response?.data?.message || Strings.retroBoard.deleteError });
    } finally {
      setBusy(false);
    }
  }, [headers, onDeleted]);

  return { editingId, deletingId, busy, error, startEdit, cancelEdit, saveEdit, askDelete, cancelDelete, confirmDelete };
}

export type CommentActions = ReturnType<typeof useCommentActions>;
