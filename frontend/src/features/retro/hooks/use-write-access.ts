import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import type { WriteAccess } from '../comment-types';

const isWriteAccess = (value: unknown): value is WriteAccess =>
  !!value && typeof value === 'object' && typeof (value as WriteAccess).canWrite === 'boolean';

/**
 * Feature 13 §13.0 decision #1/#2 — may I write on this sprint's board right now? Fetched once on
 * mount (no refetch on focus) and again from the board's explicit "רענן". The server decides.
 *
 * `isLoading` is true only until the FIRST response settles, so the board doesn't flash a write form
 * it is about to replace with the "locked" notice. A failed call is "loaded, unknown": the form stays
 * available (fail-open) and the server's 403 ("הלוח נעול לכתיבה") is the safety net.
 */
export function useWriteAccess(sprintId: number, token: string) {
  const [access, setAccess] = useState<WriteAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprintId}/write-access`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccess(isWriteAccess(response.data) ? response.data : null);
    } catch (err) {
      console.error('Failed to fetch write access:', err);
      setAccess(null);
    } finally {
      setIsLoading(false);
    }
  }, [sprintId, token]);

  useEffect(() => {
    setIsLoading(true);
    refresh();
  }, [refresh]);

  return {
    access,
    isLoading,
    canWrite: access ? access.canWrite : true,
    // Older servers don't send the flag; only an explicit false hides the anonymous option.
    anonymousAllowed: access ? access.anonymousAllowed !== false : true,
    refresh,
  };
}
