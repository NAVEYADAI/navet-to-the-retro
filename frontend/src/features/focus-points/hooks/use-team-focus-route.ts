import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';

export type TeamRouteStatus = 'loading' | 'ready' | 'notFound' | 'error';

// The management route (/team/:teamId/focus-points) can be entered cold, so it loads the team
// itself (members are needed for the task assignee list) from the user's teams.
export function useTeamFocusRoute(teamIdParam: string | undefined, token: string | null | undefined) {
  const [state, setState] = useState<{ status: TeamRouteStatus; team: any | null }>({ status: 'loading', team: null });

  const load = useCallback(async () => {
    const teamId = Number(teamIdParam);
    if (!token) return;
    if (!Number.isInteger(teamId)) {
      setState({ status: 'notFound', team: null });
      return;
    }
    setState({ status: 'loading', team: null });
    try {
      const res = await axios.get(`${getBackendUrl()}/teams/user/me`, { headers: { Authorization: `Bearer ${token}` } });
      const team = (res.data as any[]).find((t) => t.id === teamId);
      setState(team ? { status: 'ready', team } : { status: 'notFound', team: null });
    } catch (err) {
      console.error('Failed to load team for focus points:', err);
      setState({ status: 'error', team: null });
    }
  }, [teamIdParam, token]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, retry: load };
}
