import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import type { DeletedComment } from '../comment-types';

/**
 * Feature 13 §13.0 decision #5/#6 — the admin-only "הערות שנמחקו" panel. Nothing is fetched until the
 * panel is opened; `refreshKey` lets the board refetch an open panel after it deleted something itself.
 */
export function useDeletedComments(sprintId: number, token: string, refreshKey = 0) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<DeletedComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprintId}/comments/deleted`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || Strings.retroBoard.deletedPanelLoadError);
    } finally {
      setIsLoading(false);
    }
  }, [sprintId, token]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load, refreshKey]);

  const toggle = useCallback(() => {
    trackEvent(isOpen ? 'deleted_comments_panel_closed' : 'deleted_comments_panel_opened', { sprintId });
    setIsOpen(!isOpen);
  }, [isOpen, sprintId]);

  const refresh = useCallback(() => {
    trackEvent('refresh_clicked', { screen: 'deleted_comments_panel' });
    return load();
  }, [load]);

  return { isOpen, items, isLoading, error, toggle, refresh };
}
