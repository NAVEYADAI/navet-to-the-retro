import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import type { ActionItem } from '../types';

// The dashboard's "המשימות שלי": open items assigned to the current user, across all their teams.
// Mount-only fetch; the dashboard's refresh button bumps `refreshKey` to fetch again.
export function useMyActionItems(token: string | null | undefined, refreshKey = 0) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/me/action-items`, {
        params: { status: 'OPEN' },
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(response.data);
    } catch (err) {
      console.error('Failed to fetch my action items:', err);
      setLoadError(Strings.actionItems.myTasksLoadError);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { items, isLoading, loadError };
}
