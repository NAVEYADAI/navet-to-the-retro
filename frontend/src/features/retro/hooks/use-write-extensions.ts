import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import type { WriteExtension } from '../comment-types';

/** Today as YYYY-MM-DD in the device's local calendar (what a date `<Field>` produces). */
export function todayLocalIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Feature 13 §13.0 decision #2 — the admin-only "הארכת כתיבה" panel: who has an active extension on
 * this sprint, grant one (member + end date), revoke one. Fetched when the panel is opened.
 * `onChanged` lets the board refresh its own write access (an admin may extend themself).
 */
export function useWriteExtensions(sprintId: number, token: string, onChanged?: () => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<WriteExtension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // `error` = loading the list / revoking one (shown above the list); `grantError` = the grant form (shown by its button).
  const [error, setError] = useState<string | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprintId}/write-extensions`, { headers });
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || Strings.retroBoard.extensionsLoadError);
    } finally {
      setIsLoading(false);
    }
  }, [sprintId, headers]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const toggle = useCallback(() => {
    trackEvent(isOpen ? 'write_extensions_panel_closed' : 'write_extensions_panel_opened', { sprintId });
    setIsOpen(!isOpen);
  }, [isOpen, sprintId]);

  const refresh = useCallback(() => {
    trackEvent('refresh_clicked', { screen: 'write_extensions_panel' });
    return load();
  }, [load]);

  /** Validates, then POSTs. Returns true on success so the form can reset itself. */
  const grant = useCallback(async (userId: string, endDate: string): Promise<boolean> => {
    if (!userId) { setGrantError(Strings.retroBoard.extensionsPickMemberError); return false; }
    if (!endDate) { setGrantError(Strings.retroBoard.extensionsPickDateError); return false; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) { setGrantError(Strings.retroBoard.extensionsBadDateError); return false; }
    if (endDate < todayLocalIso()) { setGrantError(Strings.retroBoard.extensionsPastDateError); return false; }
    setGrantError(null);
    setError(null);
    setIsSaving(true);
    try {
      await axios.post(`${getBackendUrl()}/sprints/${sprintId}/write-extensions`, { userId: Number(userId), expiresAt: endDate }, { headers });
      trackEvent('write_extension_granted', { sprintId });
      await load();
      onChanged?.();
      return true;
    } catch (err: any) {
      trackEvent('write_extension_grant_failed', { sprintId, status: err?.response?.status ?? 0 });
      setGrantError(err?.response?.data?.message || Strings.retroBoard.extensionsGrantError);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [sprintId, headers, load, onChanged]);

  const revoke = useCallback(async (extensionId: number) => {
    setError(null);
    setGrantError(null);
    setIsSaving(true);
    try {
      await axios.delete(`${getBackendUrl()}/sprints/${sprintId}/write-extensions/${extensionId}`, { headers });
      trackEvent('write_extension_revoked', { sprintId });
      setItems((prev) => prev.filter((e) => e.id !== extensionId));
      onChanged?.();
    } catch (err: any) {
      trackEvent('write_extension_revoke_failed', { sprintId, status: err?.response?.status ?? 0 });
      setError(err?.response?.data?.message || Strings.retroBoard.extensionsRevokeError);
    } finally {
      setIsSaving(false);
    }
  }, [sprintId, headers, onChanged]);

  return { isOpen, items, isLoading, isSaving, error, grantError, toggle, refresh, grant, revoke };
}
