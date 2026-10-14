import { useCallback, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

interface Params {
  teamId: number;
  sprintId: number;
  token: string;
  /** כמה הערות יימחקו יחד עם הספרינט — מוצג באזהרה (פיצ'ר 14, החלטה #3). */
  commentCount: number;
  /** נקרא אחרי מחיקה מוצלחת — בדרך כלל חזרה לרשימת הספרינטים. */
  onDeleted: () => void;
}

/**
 * Feature 14 (product-backlog/14-sprint-and-team-deletion.md §14.2) — "מחק ספרינט" on the retro board:
 * a confirmation step that states how many comments go with it, then a soft delete. Shared by the web
 * and native boards; only the presentation differs.
 */
export function useDeleteSprint({ teamId, sprintId, token, commentCount, onDeleted }: Params) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(() => {
    trackEvent('sprint_delete_clicked', { sprintId, commentCount });
    setError(null);
    setIsConfirming(true);
  }, [sprintId, commentCount]);

  const cancel = useCallback(() => {
    trackEvent('sprint_delete_cancelled', { sprintId });
    setIsConfirming(false);
    setError(null);
  }, [sprintId]);

  const confirm = useCallback(async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await axios.delete(`${getBackendUrl()}/teams/${teamId}/sprints/${sprintId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      trackEvent('sprint_deleted', { sprintId, commentCount });
      setIsConfirming(false);
      onDeleted();
    } catch (err: any) {
      setError(err?.response?.data?.message || Strings.sprintDeletion.deleteError);
    } finally {
      setIsDeleting(false);
    }
  }, [teamId, sprintId, token, commentCount, onDeleted]);

  return { isConfirming, isDeleting, error, ask, cancel, confirm };
}
