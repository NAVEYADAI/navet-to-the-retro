import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';

export type SprintRouteStatus = 'loading' | 'ready' | 'notFound' | 'error';

interface SprintRouteData {
  status: SprintRouteStatus;
  team: any | null;
  sprint: any | null;
}

// BUG-33: the board / summary / memory routes can be entered cold (F5, a shared link), so they
// cannot rely on the Dashboard having passed `sprint` + `team` down. There is no single-sprint
// endpoint, so this loads the user's teams and that team's sprint list in parallel and picks the
// matching rows. Mount-only fetch (plus `retry()` for the explicit button) — no refetch-on-focus.
//
// - team not among the user's teams, sprint not in the team (or the sprints call 403s because the
//   user isn't an ACTIVE member) -> `notFound` (we deliberately don't distinguish "doesn't exist"
//   from "not yours" — same screen, no information leak)
// - network / 5xx -> `error` (a 401 is handled globally by the axios interceptor -> logout)
export function useSprintRouteData(teamIdParam: string | undefined, sprintIdParam: string | undefined, token: string | null | undefined) {
  const [data, setData] = useState<SprintRouteData>({ status: 'loading', team: null, sprint: null });

  const load = useCallback(async () => {
    const teamId = Number(teamIdParam);
    const sprintId = Number(sprintIdParam);
    if (!token) return;
    if (!Number.isInteger(teamId) || !Number.isInteger(sprintId)) {
      setData({ status: 'notFound', team: null, sprint: null });
      return;
    }
    setData({ status: 'loading', team: null, sprint: null });
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [teamsRes, sprintsRes] = await Promise.all([
        axios.get(`${getBackendUrl()}/teams/user/me`, { headers }),
        axios.get(`${getBackendUrl()}/teams/${teamId}/sprints`, { headers }).catch((err) => {
          // Not a member of that team: treated as "not found" below, not as a load error.
          if (err?.response?.status === 403 || err?.response?.status === 404) return null;
          throw err;
        }),
      ]);
      const team = (teamsRes.data as any[]).find((tm) => tm.id === teamId);
      const sprint = sprintsRes ? (sprintsRes.data as any[]).find((s) => s.id === sprintId) : undefined;
      if (!team || !sprint) {
        setData({ status: 'notFound', team: null, sprint: null });
        return;
      }
      setData({ status: 'ready', team, sprint });
    } catch (err) {
      console.error('Failed to load sprint route data:', err);
      setData({ status: 'error', team: null, sprint: null });
    }
  }, [teamIdParam, sprintIdParam, token]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...data, retry: load };
}
