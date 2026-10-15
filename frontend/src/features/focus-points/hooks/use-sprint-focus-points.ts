import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import type { SprintFocusView } from '../types';

// The member side, on the retro board: the points selected for this sprint + my own rating (never
// a score or anyone else's rating — the server doesn't send them), and "which comments did I
// already propose". Mount-only fetch + `refresh` for the screen's "רענן".
export function useSprintFocusPoints(sprintId: number, token: string) {
  const [view, setView] = useState<SprintFocusView | null>(null);
  const [proposedIds, setProposedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const viewedRef = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [viewRes, proposedRes] = await Promise.all([
        axios.get(`${getBackendUrl()}/sprints/${sprintId}/focus-points`, { headers }),
        axios.get(`${getBackendUrl()}/sprints/${sprintId}/proposed-comments`, { headers }),
      ]);
      // Defensive shape check: an unexpected body must never break the retro board around it.
      const valid = Array.isArray(viewRes.data?.points);
      setView(valid ? viewRes.data : null);
      // Process tracking: did members actually get to see (and could they rate) this sprint's points?
      if (valid && viewRes.data.points.length > 0 && !viewedRef.current) {
        viewedRef.current = true;
        trackEvent('sprint_focus_points_viewed', {
          sprintId, points: viewRes.data.points.length, window: viewRes.data.window,
          alreadyRated: viewRes.data.points.filter((p: { myRating: unknown }) => p.myRating).length,
        });
      }
      setProposedIds(Array.isArray(proposedRes.data) ? proposedRes.data.filter((x: unknown) => typeof x === 'number') : []);
    } catch (err: any) {
      console.error('Failed to load sprint focus points:', err);
      trackEvent('sprint_focus_points_load_failed', { sprintId, status: err?.response?.status ?? 0 });
      setLoadError(Strings.focusPoints.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [sprintId, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Throws on failure (409 = already proposed, which the UI treats as proposed). */
  const propose = async (commentId: number) => {
    try {
      await axios.post(`${getBackendUrl()}/comments/${commentId}/propose`, {}, { headers: { Authorization: `Bearer ${token}` } });
      trackEvent('focus_point_proposed', { sprintId });
    } catch (err: any) {
      if (err?.response?.status !== 409) {
        trackEvent('focus_point_propose_failed', { sprintId, status: err?.response?.status ?? 0 });
        throw err;
      }
      // Already proposed (e.g. from another device): tracked separately so it is not counted as a proposal.
      trackEvent('focus_point_propose_duplicate', { sprintId });
    }
    setProposedIds((prev) => (prev.includes(commentId) ? prev : [...prev, commentId]));
  };

  /** Throws on failure. */
  const rate = async (pointId: number, score: number, reason: string) => {
    const isUpdate = !!view?.points.find((p) => p.id === pointId)?.myRating;
    try {
      await axios.put(`${getBackendUrl()}/focus-points/${pointId}/rating`, { sprintId, score, reason: reason.trim() || undefined }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err: any) {
      trackEvent('focus_point_rate_failed', { sprintId, status: err?.response?.status ?? 0 });
      throw err;
    }
    // Deliberately NOT the score or the point: PostHog knows who the user is, and the product promises
    // the team an anonymous rating. Participation (did they rate, with a reason or not) is what process tracking needs.
    trackEvent('focus_point_rated', { sprintId, isUpdate, hasReason: !!reason.trim() });
    setView((prev) => prev && ({
      ...prev,
      points: prev.points.map((p) => (p.id === pointId ? { ...p, myRating: { score, reason: reason.trim() || null } } : p)),
    }));
  };

  return { view, proposedIds, isLoading, loadError, refresh, propose, rate };
}
