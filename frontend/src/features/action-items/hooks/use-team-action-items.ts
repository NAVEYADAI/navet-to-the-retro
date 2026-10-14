import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import type { ActionItem, ActionItemStatus } from '../types';

export interface CreateActionItemInput {
  title: string;
  sourceCommentId?: number;
  assigneeIds: number[];
  /** "YYYY-MM-DD" or '' */
  dueDate: string;
}

export type StatusSource = 'panel' | 'previous_strip';

// Shared by the web and native sections. The team's action items are fetched on mount only (this
// project's data-freshness rule — no refetch-on-focus), with an explicit `refresh` for the screen's
// "רענן" button. Every mutation replaces the affected row from the server's response, so the lists
// never drift from what was actually saved.
export function useTeamActionItems(teamId: number, token: string) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${token}` };

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/${teamId}/action-items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(response.data);
    } catch (err) {
      console.error('Failed to fetch action items:', err);
      setLoadError(Strings.actionItems.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const replace = (updated: ActionItem) =>
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

  /** Throws on failure so the form can show the server's message. */
  const create = async (sprintId: number, input: CreateActionItemInput): Promise<ActionItem> => {
    const response = await axios.post(
      `${getBackendUrl()}/sprints/${sprintId}/action-items`,
      {
        title: input.title.trim(),
        sourceCommentId: input.sourceCommentId,
        assigneeIds: input.assigneeIds,
        dueDate: input.dueDate || undefined,
      },
      { headers }
    );
    setItems((prev) => [...prev, response.data]);
    trackEvent('action_item_created', { fromComment: input.sourceCommentId !== undefined });
    return response.data;
  };

  const patch = async (id: number, body: Record<string, unknown>): Promise<ActionItem> => {
    const response = await axios.patch(`${getBackendUrl()}/action-items/${id}`, body, { headers });
    replace(response.data);
    return response.data;
  };

  /** Throws on failure. */
  const setStatus = async (id: number, status: ActionItemStatus, source: StatusSource) => {
    await patch(id, { status });
    trackEvent(source === 'previous_strip' ? 'previous_action_items_status_changed' : 'action_item_status_changed', { status });
  };

  /** Applies a form edit; `changes` holds only the fields that differ. Throws on failure. */
  const edit = async (id: number, changes: { title?: string; assigneeIds?: number[]; dueDate?: string | null }) => {
    await patch(id, changes);
    if (changes.assigneeIds) trackEvent('action_item_assignees_changed', { count: changes.assigneeIds.length });
    if (changes.dueDate !== undefined) trackEvent('action_item_due_date_changed', { cleared: changes.dueDate === null });
  };

  /** Throws on failure. */
  const remove = async (id: number) => {
    await axios.delete(`${getBackendUrl()}/action-items/${id}`, { headers });
    setItems((prev) => prev.filter((item) => item.id !== id));
    trackEvent('action_item_deleted');
  };

  return { items, isLoading, loadError, refresh, create, setStatus, edit, remove };
}
