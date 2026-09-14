import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import { getBackendUrl } from '@/api/config';
import { trackEvent } from '@/lib/analytics';
import { Strings } from '@/constants/strings';

type Message = { text: string; isError: boolean } | null;

/**
 * Personal Google Calendar connection (product-backlog/06-google-calendar-integration.md §6). Fetches status on mount only —
 * no auto-refetch-on-focus (see [[feedback-frontend-data-freshness]]). After the OAuth
 * round-trip, the backend redirects the browser back to `/settings?googleCalendar=connected|error`
 * — this hook reads that query param once, shows the matching message, refetches status on
 * success, and clears the param so a page refresh doesn't re-show it.
 */
export function useGoogleCalendar(token: string | null | undefined) {
  const params = useLocalSearchParams<{ googleCalendar?: string }>();
  const [connected, setConnected] = useState(false);
  const [googleAccountEmail, setGoogleAccountEmail] = useState<string | undefined>(undefined);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    setStatusLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/google-calendar/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnected(!!response.data?.connected);
      setGoogleAccountEmail(response.data?.googleAccountEmail);
    } catch (err) {
      console.error('Failed to fetch Google Calendar status:', err);
    } finally {
      setStatusLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    // Mount-only fetch, intentionally excludes `fetchStatus` from deps beyond mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!params.googleCalendar) return;

    if (params.googleCalendar === 'connected') {
      setMessage({ text: Strings.settings.googleCalendarConnectedMessage, isError: false });
      trackEvent('google_calendar_connect_succeeded');
      fetchStatus();
    } else if (params.googleCalendar === 'error') {
      setMessage({ text: Strings.settings.googleCalendarConnectError, isError: true });
      trackEvent('google_calendar_connect_failed', { reason: 'redirect_error' });
    }

    // Clear the query param so refreshing the page doesn't re-show the message.
    router.replace('/settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.googleCalendar]);

  const handleConnect = async () => {
    trackEvent('google_calendar_connect_clicked');
    setMessage(null);
    setConnectLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/google-calendar/connect`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const authUrl = response.data?.authUrl;
      if (!authUrl) throw new Error('no authUrl');
      if (typeof window !== 'undefined') {
        window.location.href = authUrl;
      }
    } catch (err) {
      console.error('Failed to start Google Calendar connect flow:', err);
      setMessage({ text: Strings.settings.googleCalendarConnectError, isError: true });
      trackEvent('google_calendar_connect_failed', { reason: 'connect_request_failed' });
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async () => {
    trackEvent('google_calendar_disconnect_clicked');
    setMessage(null);
    setDisconnectLoading(true);
    try {
      await axios.patch(
        `${getBackendUrl()}/google-calendar/disconnect`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConnected(false);
      setGoogleAccountEmail(undefined);
      setMessage({ text: Strings.settings.googleCalendarDisconnectedMessage, isError: false });
    } catch (err) {
      console.error('Failed to disconnect Google Calendar:', err);
      setMessage({ text: Strings.settings.googleCalendarDisconnectError, isError: true });
    } finally {
      setDisconnectLoading(false);
    }
  };

  return {
    connected,
    googleAccountEmail,
    statusLoading,
    connectLoading,
    disconnectLoading,
    message,
    handleConnect,
    handleDisconnect,
  };
}
