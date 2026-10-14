import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { notifyTeamsChanged } from '@/features/dashboard/teams-changed-signal';

export interface DeletedTeam {
  id: number;
  name: string;
  mainOffice: string | null;
  sprintCount: number;
  daysLeft: number;
}

/**
 * Feature 14 (§14.2, technical default #7) — "צוותים שנמחקו" in the settings: teams the user was an
 * ACTIVE admin of when they were deleted, restorable for 30 days. Fetched on mount, refreshed by
 * the explicit refresh button (the app does not refetch on focus).
 */
export function useDeletedTeams(token: string | null) {
  const [items, setItems] = useState<DeletedTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${getBackendUrl()}/teams/deleted`, { headers: { Authorization: `Bearer ${token}` } });
      setItems(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || Strings.deletedTeams.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const restore = useCallback(async (team: DeletedTeam) => {
    if (!token) return;
    setError(null);
    setRestoringId(team.id);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } });
      trackEvent('team_restored', { teamId: team.id, sprintCount: team.sprintCount });
      setItems((prev) => prev.filter((t) => t.id !== team.id));
      notifyTeamsChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || Strings.deletedTeams.restoreError);
    } finally {
      setRestoringId(null);
    }
  }, [token]);

  return { items, isLoading, error, restoringId, load, restore };
}
