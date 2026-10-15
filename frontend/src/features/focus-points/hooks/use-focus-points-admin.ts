import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { defaultSprintId } from '../focus-points-logic';
import type { FocusPointKind, PoolData, Proposal, SprintFocusView, TaskStatus } from '../types';

export interface PointInput {
  kind: FocusPointKind;
  text: string;
  initialScore?: number;
  sourceCommentIds?: number[];
}

export interface TaskInput {
  title: string;
  assigneeId: number | null;
  /** "YYYY-MM-DD" or '' */
  dueDate: string;
}

// The management screen's data + actions (admin / team leader). Mount-only fetch with an explicit
// `refresh` (project rule: no refetch-on-focus). Every action re-reads what it changed so the
// screen never drifts from the server; actions THROW on failure and the components show the message.
export function useFocusPointsAdmin(teamId: number, token: string) {
  const [pool, setPool] = useState<PoolData | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [sprints, setSprints] = useState<{ id: number; name: string; startDate: string; endDate: string }[]>([]);
  const [sprintId, setSprintId] = useState<number | null>(null);
  const [sprintView, setSprintView] = useState<SprintFocusView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${token}` };
  const url = getBackendUrl();
  const viewedRef = useRef(false);

  const loadSprintView = useCallback(async (id: number | null) => {
    if (id === null) {
      setSprintView(null);
      return;
    }
    const res = await axios.get(`${url}/sprints/${id}/focus-points`, { headers: { Authorization: `Bearer ${token}` } });
    setSprintView(res.data);
  }, [token, url]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const h = { Authorization: `Bearer ${token}` };
    try {
      const [poolRes, proposalsRes, sprintsRes] = await Promise.all([
        axios.get(`${url}/teams/${teamId}/focus-points`, { headers: h }),
        axios.get(`${url}/teams/${teamId}/focus-point-proposals`, { headers: h }),
        axios.get(`${url}/teams/${teamId}/sprints`, { headers: h }),
      ]);
      setPool(poolRes.data);
      setProposals(proposalsRes.data);
      setSprints(sprintsRes.data);
      const chosen = sprintId ?? defaultSprintId(sprintsRes.data);
      setSprintId(chosen);
      await loadSprintView(chosen);
      // Process tracking: one "screen viewed" per visit with the size of what the manager faced.
      if (!viewedRef.current) {
        viewedRef.current = true;
        const points = poolRes.data.points as { kind: string; status: string }[];
        trackEvent('focus_points_screen_viewed', {
          teamId, quota: poolRes.data.quota, resultsHidden: poolRes.data.resultsHidden,
          activePoints: points.filter((p) => p.kind === 'IMPROVE' && p.status === 'ACTIVE').length,
          keepPoints: points.filter((p) => p.kind === 'KEEP').length,
          pendingProposals: proposalsRes.data.length,
        });
      }
    } catch (err: any) {
      console.error('Failed to load focus points:', err);
      trackEvent('focus_points_load_failed', { teamId, status: err?.response?.status ?? 0 });
      setLoadError(Strings.focusPoints.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, token, url, sprintId, loadSprintView]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, token]);

  const reload = async () => {
    const h = { Authorization: `Bearer ${token}` };
    const [poolRes, proposalsRes] = await Promise.all([
      axios.get(`${url}/teams/${teamId}/focus-points`, { headers: h }),
      axios.get(`${url}/teams/${teamId}/focus-point-proposals`, { headers: h }),
    ]);
    setPool(poolRes.data);
    setProposals(proposalsRes.data);
    await loadSprintView(sprintId);
  };

  const chooseSprint = async (id: number) => {
    trackEvent('focus_points_sprint_changed');
    setSprintId(id);
    await loadSprintView(id);
  };

  const createPoint = async (input: PointInput) => {
    await axios.post(`${url}/teams/${teamId}/focus-points`, input, { headers });
    trackEvent('focus_point_created', { teamId, kind: input.kind, fromProposal: !!input.sourceCommentIds?.length });
    await reload();
  };

  const editPoint = async (id: number, body: Record<string, unknown>) => {
    await axios.patch(`${url}/focus-points/${id}`, body, { headers });
    if (body.status === 'ARCHIVED') trackEvent('focus_point_archived');
    else if (body.status === 'ACTIVE') trackEvent('focus_point_reopened');
    if (body.text !== undefined) trackEvent('focus_point_edited');
    if (body.watchSprintsLeft !== undefined) trackEvent('focus_point_watch_changed', { cleared: body.watchSprintsLeft === null });
    await reload();
  };

  const mergePoint = async (id: number, intoId: number) => {
    await axios.post(`${url}/focus-points/${id}/merge`, { intoId }, { headers });
    trackEvent('focus_point_merged', { teamId });
    await reload();
  };

  const dismissProposal = async (commentId: number) => {
    await axios.delete(`${url}/comments/${commentId}/proposals`, { headers });
    trackEvent('focus_point_proposal_dismissed', { teamId });
    await reload();
  };

  const setSelected = async (pointId: number, selected: boolean) => {
    if (sprintId === null) return;
    const path = `${url}/sprints/${sprintId}/focus-points/${pointId}/select`;
    if (selected) await axios.put(path, {}, { headers });
    else await axios.delete(path, { headers });
    // The quota is what managers run into, so record how full it is after this action.
    trackEvent(selected ? 'focus_point_selected' : 'focus_point_deselected', {
      teamId, sprintId, selectedCount: Math.max(0, (sprintView?.points.length ?? 0) + (selected ? 1 : -1)), quota: pool?.quota ?? 0,
    });
    await reload();
  };

  const closeWindow = async () => {
    if (sprintId === null) return [];
    const res = await axios.post(`${url}/sprints/${sprintId}/rating-close`, {}, { headers });
    const outcomes = res.data.outcomes as { focusPointId: number; outcome: string }[];
    const count = (o: string) => outcomes.filter((x) => x.outcome === o).length;
    trackEvent('rating_window_closed', {
      teamId, sprintId, points: outcomes.length, closed: count('CLOSED'), archived: count('ARCHIVED'),
      continues: count('CONTINUES'), notCounted: count('NOT_COUNTED'),
    });
    await reload();
    return outcomes;
  };

  const saveQuota = async (quota: number) => {
    await axios.patch(`${url}/teams/${teamId}/focus-point-settings`, { quota }, { headers });
    trackEvent('focus_point_quota_changed', { teamId, quota });
    await reload();
  };

  const addTask = async (pointId: number, input: TaskInput) => {
    await axios.post(`${url}/focus-points/${pointId}/tasks`, {
      title: input.title.trim(), assigneeId: input.assigneeId, dueDate: input.dueDate || undefined,
    }, { headers });
    trackEvent('focus_point_task_created', { assigned: input.assigneeId !== null });
    await reload();
  };

  const setTaskStatus = async (taskId: number, status: TaskStatus) => {
    await axios.patch(`${url}/focus-point-tasks/${taskId}`, { status }, { headers });
    trackEvent('focus_point_task_status_changed', { status });
    await reload();
  };

  const removeTask = async (taskId: number) => {
    await axios.delete(`${url}/focus-point-tasks/${taskId}`, { headers });
    trackEvent('focus_point_task_deleted');
    await reload();
  };

  return {
    pool, proposals, sprints, sprintId, sprintView, isLoading, loadError, refresh,
    chooseSprint, createPoint, editPoint, mergePoint, dismissProposal, setSelected, closeWindow,
    saveQuota, addTask, setTaskStatus, removeTask,
  };
}
