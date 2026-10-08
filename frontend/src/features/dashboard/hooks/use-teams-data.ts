import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { subscribeTeamsChanged } from '../teams-changed-signal';

// Shared between the web and native Dashboard variants: fetches the current user's teams on
// mount only — no longer refetches on every focus (that caused a full loading-flash on every
// return to the Dashboard, even from an unrelated screen; see [[feedback-frontend-data-freshness]]).
// `fetchMyTeams` is returned so the screen can wire up an explicit refresh button instead.
//
// `isLoadingTeams` is true only for the INITIAL load (no data yet). Every later fetch — the
// refresh button, a refetch after saving team details / changing a member's role, a refetch after
// a team was created in /settings — is a background refresh: `isRefreshing` flips instead, and the
// rendered team list stays mounted, so open panels / one-time links / typed drafts aren't lost
// (BUG-28).
export function useTeamsData(token: string | null | undefined) {
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  // Set when the fetch fails, so screens show an error instead of the "not in any team" empty
  // state (BUG-34, teams part). A 401 additionally logs the user out via the axios interceptor.
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchMyTeams = useCallback(async (authToken: string) => {
    const isInitial = !hasLoadedRef.current;
    if (isInitial) setIsLoadingTeams(true);
    else setIsRefreshing(true);
    setLoadError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/user/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = response.data;
      setTeams(data);
      hasLoadedRef.current = true;

      setSelectedTeam((prev: any) => {
        if (!prev) return prev;
        const updated = data.find((t: any) => t.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setLoadError(Strings.dashboard.teamsLoadError);
    } finally {
      setIsLoadingTeams(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      // A different token = a different session/user: don't keep the previous user's list.
      hasLoadedRef.current = false;
      fetchMyTeams(token);
    }
  }, [token, fetchMyTeams]);

  // Another screen (settings) created a team while this one stayed mounted — refetch in background.
  useEffect(() => subscribeTeamsChanged(() => {
    if (token) fetchMyTeams(token);
  }), [token, fetchMyTeams]);

  const refresh = useCallback(() => {
    if (token) {
      fetchMyTeams(token);
    }
  }, [token, fetchMyTeams]);

  return { teams, isLoadingTeams, isRefreshing, loadError, selectedTeam, setSelectedTeam, fetchMyTeams, refresh };
}
