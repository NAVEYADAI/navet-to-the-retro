import { useCallback, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

export interface DeletedSprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  commentCount: number;
  /** ימים שנותרו לשחזור (0 = היום האחרון). */
  daysLeft: number;
}

interface Params {
  teamId: number;
  token: string;
  /** נקרא אחרי שחזור מוצלח, כדי שרשימת הספרינטים תיטען מחדש. */
  onRestored: () => void;
}

/**
 * Feature 14 (§14.2) — the admin-only "ספרינטים שנמחקו" list under a team's sprints. Fetched when
 * the admin opens it (not on every team card), refreshed explicitly like the rest of the app.
 */
export function useDeletedSprints({ teamId, token, onRestored }: Params) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<DeletedSprint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${getBackendUrl()}/teams/${teamId}/sprints/deleted`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || Strings.sprintDeletion.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, token]);

  const toggle = useCallback(() => {
    const next = !isOpen;
    trackEvent('deleted_sprints_toggled', { open: next });
    setIsOpen(next);
    if (next) void load();
  }, [isOpen, load]);

  const restore = useCallback(async (sprint: DeletedSprint) => {
    setError(null);
    setRestoringId(sprint.id);
    try {
      await axios.post(`${getBackendUrl()}/teams/${teamId}/sprints/${sprint.id}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      trackEvent('sprint_restored', { sprintId: sprint.id, commentCount: sprint.commentCount });
      setItems((prev) => prev.filter((s) => s.id !== sprint.id));
      onRestored();
    } catch (err: any) {
      setError(err?.response?.data?.message || Strings.sprintDeletion.restoreError);
    } finally {
      setRestoringId(null);
    }
  }, [teamId, token, onRestored]);

  return { isOpen, items, isLoading, error, restoringId, toggle, load, restore };
}
