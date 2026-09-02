import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';

// Shared between the web and native Dashboard variants: fetches the current user's teams on
// mount only — no longer refetches on every focus (that caused a full loading-flash on every
// return to the Dashboard, even from an unrelated screen; see [[feedback-frontend-data-freshness]]).
// `fetchMyTeams` is returned so the screen can wire up an explicit refresh button instead.
export function useTeamsData(token: string | null | undefined) {
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  const fetchMyTeams = useCallback(async (authToken: string) => {
    setIsLoadingTeams(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/user/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = response.data;
      setTeams(data);

      setSelectedTeam((prev: any) => {
        if (!prev) return prev;
        const updated = data.find((t: any) => t.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setIsLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchMyTeams(token);
    }
  }, [token, fetchMyTeams]);

  const refresh = useCallback(() => {
    if (token) {
      fetchMyTeams(token);
    }
  }, [token, fetchMyTeams]);

  return { teams, isLoadingTeams, selectedTeam, setSelectedTeam, fetchMyTeams, refresh };
}
