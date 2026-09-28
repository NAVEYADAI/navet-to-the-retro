import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { trackEvent } from '@/lib/analytics';
import { Strings } from '@/constants/strings';

type Message = { text: string; isError: boolean } | null;

/**
 * Raw payload the Telegram Login Widget hands to its `data-onauth` callback
 * (`id, first_name, username?, photo_url?, auth_date, hash`) — see `telegram-link-card.tsx`.
 * Forwarded as-is to `POST /auth/telegram/link`, which verifies `hash` server-side.
 */
export type TelegramWidgetAuthPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

/**
 * Personal Telegram account link (product-backlog/10-telegram-comment-ingestion.md §10.2).
 * Mirrors `use-google-calendar.ts`: fetches status on mount only — no auto-refetch-on-focus
 * (see [[feedback-frontend-data-freshness]]). Unlike Google Calendar, linking doesn't redirect
 * the browser away and back — the widget hands back a signed payload directly to a callback in
 * the page, so `handleLinked` posts it straight away instead of reading a redirect query param.
 */
export function useTelegramLink(token: string | null | undefined) {
  const [connected, setConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    setStatusLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/auth/telegram/link/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnected(!!response.data?.connected);
    } catch (err) {
      console.error('Failed to fetch Telegram link status:', err);
    } finally {
      setStatusLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    // Mount-only fetch, intentionally excludes `fetchStatus` from deps beyond mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLinked = async (payload: TelegramWidgetAuthPayload) => {
    trackEvent('telegram_link_widget_completed');
    setMessage(null);
    setLinkLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/auth/telegram/link`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnected(true);
      setMessage({ text: Strings.settings.telegramLinkedMessage, isError: false });
      trackEvent('telegram_link_succeeded');
    } catch (err) {
      console.error('Failed to link Telegram account:', err);
      setMessage({ text: Strings.settings.telegramLinkError, isError: true });
      trackEvent('telegram_link_failed');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlink = async () => {
    trackEvent('telegram_unlink_clicked');
    setMessage(null);
    setUnlinkLoading(true);
    try {
      await axios.delete(`${getBackendUrl()}/auth/telegram/link`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnected(false);
      setMessage({ text: Strings.settings.telegramUnlinkedMessage, isError: false });
      trackEvent('telegram_unlink_succeeded');
    } catch (err) {
      console.error('Failed to unlink Telegram account:', err);
      setMessage({ text: Strings.settings.telegramUnlinkError, isError: true });
      trackEvent('telegram_unlink_failed');
    } finally {
      setUnlinkLoading(false);
    }
  };

  return {
    connected,
    statusLoading,
    linkLoading,
    unlinkLoading,
    message,
    handleLinked,
    handleUnlink,
  };
}
