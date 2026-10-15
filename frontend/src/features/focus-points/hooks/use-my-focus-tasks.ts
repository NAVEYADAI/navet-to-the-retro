import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import type { FocusPointTask } from '../types';

// Dashboard "המשימות שלי": my open tasks from improvement points, across my teams. Mount-only;
// the dashboard's refresh button bumps `refreshKey`.
export function useMyFocusTasks(token: string | null | undefined, refreshKey = 0) {
  const [items, setItems] = useState<FocusPointTask[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const res = await axios.get(`${getBackendUrl()}/me/focus-point-tasks`, { params: { status: 'OPEN' }, headers: { Authorization: `Bearer ${token}` } });
      setItems(res.data);
      // Shown only when there is something to show — so this event measures how often tasks reach a person.
      if (Array.isArray(res.data) && res.data.length > 0) {
        trackEvent('my_focus_tasks_viewed', {
          count: res.data.length,
          overdue: res.data.filter((t: { dueDate: string | null }) => t.dueDate && new Date(t.dueDate).getTime() < Date.now()).length,
        });
      }
    } catch (err: any) {
      trackEvent('my_focus_tasks_load_failed', { status: err?.response?.status ?? 0 });
      console.error('Failed to fetch my focus point tasks:', err);
      setLoadError(Strings.focusPoints.myTasksLoadError);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { items, loadError };
}
