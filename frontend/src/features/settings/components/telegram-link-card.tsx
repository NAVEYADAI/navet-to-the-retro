import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Card, Button } from '@/components/ui';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import { trackEvent } from '@/lib/analytics';
import { getFrontendUrl } from '@/api/config';
import { useTelegramLink, type TelegramWidgetAuthPayload } from '../hooks/use-telegram-link';

const WIDGET_SCRIPT_SRC = 'https://telegram.org/js/telegram-widget.js?22';
const BOT_USERNAME = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME;

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetAuthPayload) => void;
  }
}

/**
 * Personal Telegram account link (product-backlog/10-telegram-comment-ingestion.md §10.2), on the
 * pattern of `google-calendar-card.tsx`. Web: embeds the real Telegram Login Widget (a `<script>`
 * that injects its own iframe/button into a container div and calls a global callback with a
 * signed payload — no OAuth redirect round-trip). Native: the widget is a browser-DOM script and
 * can't run in React Native at all, so this shows an "open in browser" button instead, same
 * technique as `ExternalLink` (`openBrowserAsync`) — the web page it opens hosts the real widget.
 */
export function TelegramLinkCard() {
  const t = useTheme();
  const { token } = useAuth();
  const {
    connected,
    statusLoading,
    linkLoading,
    unlinkLoading,
    message,
    handleLinked,
    handleUnlink,
  } = useTelegramLink(token);

  const widgetContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || connected || !BOT_USERNAME) return;
    const container = widgetContainerRef.current;
    if (!container) return;

    window.onTelegramAuth = (user: TelegramWidgetAuthPayload) => {
      handleLinked(user);
    };

    const script = document.createElement('script');
    script.src = WIDGET_SCRIPT_SRC;
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    container.replaceChildren(script);
    trackEvent('telegram_link_widget_loaded');

    return () => {
      container.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [connected, handleLinked]);

  const handleOpenInBrowser = async () => {
    trackEvent('telegram_open_in_browser_clicked');
    await openBrowserAsync(`${getFrontendUrl()}/settings`);
  };

  return (
    <Card padding={5}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
          {Strings.settings.telegramCardTitle}
        </Typography>
        <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
          {Strings.settings.telegramCardSubtitle}
        </Typography>
      </Box>

      {message && (
        <Alert severity={message.isError ? 'error' : 'success'} sx={{ ...t.type.body }}>
          {message.text}
        </Alert>
      )}

      {statusLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[2]}px` }}>
          <CircularProgress size={16} sx={{ color: t.color.textMuted }} />
          <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>
            {Strings.settings.telegramStatusLoading}
          </Typography>
        </Box>
      ) : connected ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
          <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, minWidth: 0 }}>
            {Strings.settings.telegramConnectedText}
          </Typography>
          <Button
            variant="danger"
            size="sm"
            onPress={handleUnlink}
            disabled={unlinkLoading}
            loading={unlinkLoading}
          >
            {Strings.settings.telegramDisconnectButton}
          </Button>
        </Box>
      ) : Platform.OS === 'web' ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>
            {Strings.settings.telegramNotConnectedText}
          </Typography>
          {BOT_USERNAME ? (
            <Box ref={widgetContainerRef} sx={{ minHeight: 40 }} />
          ) : (
            <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
              {Strings.settings.telegramWidgetUnavailableText}
            </Typography>
          )}
          {linkLoading && <CircularProgress size={16} sx={{ color: t.color.textMuted }} />}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, minWidth: 0 }}>
            {Strings.settings.telegramNativeUnavailableText}
          </Typography>
          <Button variant="secondary" size="sm" onPress={handleOpenInBrowser}>
            {Strings.settings.telegramOpenInBrowserButton}
          </Button>
        </Box>
      )}
    </Card>
  );
}
