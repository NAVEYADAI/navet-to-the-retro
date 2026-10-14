import { useCallback, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { notifyTeamsChanged } from '@/features/dashboard/teams-changed-signal';

interface Params {
  teamId: number;
  teamName: string;
  token: string;
  /** נקרא אחרי מחיקה מוצלחת (רענון רשימת הצוותים). */
  onDeleted: () => void;
}

/** השוואת שם לאישור מחיקה — אותו כלל כמו בשרת (`trim` משני הצדדים, התאמה מדויקת). */
export function isDeleteConfirmationMatch(typed: string, teamName: string): boolean {
  return typed.trim() === teamName.trim();
}

/**
 * Feature 14 (§14.2, decision #4) — "אזור מסוכן" in the team settings: deleting a team requires typing
 * its exact name. Shared by the web and native settings panels.
 */
export function useDeleteTeam({ teamId, teamName, token, onDeleted }: Params) {
  const [isOpen, setIsOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = isDeleteConfirmationMatch(typedName, teamName);

  const open = useCallback(() => {
    trackEvent('team_delete_clicked', { teamId });
    setError(null);
    setTypedName('');
    setIsOpen(true);
  }, [teamId]);

  const cancel = useCallback(() => {
    trackEvent('team_delete_cancelled', { teamId });
    setIsOpen(false);
    setTypedName('');
    setError(null);
  }, [teamId]);

  const confirm = useCallback(async () => {
    if (!isDeleteConfirmationMatch(typedName, teamName)) return;
    setError(null);
    setIsDeleting(true);
    try {
      await axios.delete(`${getBackendUrl()}/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { confirmName: typedName },
      });
      trackEvent('team_deleted', { teamId });
      setIsOpen(false);
      notifyTeamsChanged();
      onDeleted();
    } catch (err: any) {
      setError(err?.response?.data?.message || Strings.teamDeletion.deleteError);
    } finally {
      setIsDeleting(false);
    }
  }, [teamId, teamName, token, typedName, onDeleted]);

  return { isOpen, typedName, setTypedName, canConfirm, isDeleting, error, open, cancel, confirm };
}
