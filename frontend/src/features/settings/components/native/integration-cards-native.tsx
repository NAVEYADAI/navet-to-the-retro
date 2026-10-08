import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { useTheme } from '@/design/theme-context';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import { trackEvent } from '@/lib/analytics';
import { getFrontendUrl } from '@/api/config';
import { useGoogleCalendar } from '../../hooks/use-google-calendar';
import { useTelegramLink } from '../../hooks/use-telegram-link';
import { CardNative, ButtonNative, MessageNative, rnText } from './settings-native-parts';

function StatusLoading({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
      <ActivityIndicator size="small" color={t.color.textMuted} />
      <Text style={[rnText(t.type.body), { color: t.color.textMuted }]}>{text}</Text>
    </View>
  );
}

function StatusRow({ text, strong, children }: { text: string; strong?: boolean; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[3] }}>
      <Text style={[rnText(strong ? t.type.bodyStrong : t.type.body), { color: strong ? t.color.text : t.color.textMuted, textAlign: 'right' }]}>
        {text}
      </Text>
      {children}
    </View>
  );
}

const openSettingsInBrowser = async (event: string) => {
  trackEvent(event);
  await openBrowserAsync(`${getFrontendUrl()}/settings`);
};

/**
 * Personal Google Calendar connection on native. Status + disconnect work through the API; the
 * OAuth connect redirect is a browser flow (`window.location.href`), so connecting is handed off to
 * the web page — same approach as the Telegram card.
 */
export function GoogleCalendarCardNative() {
  const { token } = useAuth();
  const { connected, googleAccountEmail, statusLoading, statusError, disconnectLoading, message, handleDisconnect } =
    useGoogleCalendar(token);

  return (
    <CardNative title={Strings.settings.googleCalendarCardTitle} subtitle={Strings.settings.googleCalendarCardSubtitle}>
      {message ? <MessageNative text={message.text} isError={message.isError} /> : null}
      {statusLoading ? (
        <StatusLoading text={Strings.settings.googleCalendarStatusLoading} />
      ) : statusError ? null : connected ? (
        <StatusRow strong text={Strings.settings.googleCalendarConnectedLabel(googleAccountEmail || '')}>
          <ButtonNative variant="danger" onPress={handleDisconnect} loading={disconnectLoading}>
            {Strings.settings.googleCalendarDisconnectButton}
          </ButtonNative>
        </StatusRow>
      ) : (
        <StatusRow text={`${Strings.settings.googleCalendarNotConnectedText}. ${Strings.settings.googleCalendarNativeUnavailableText}`}>
          <ButtonNative onPress={() => openSettingsInBrowser('google_calendar_open_in_browser_clicked')}>
            {Strings.settings.telegramOpenInBrowserButton}
          </ButtonNative>
        </StatusRow>
      )}
    </CardNative>
  );
}

/** Personal Telegram link on native: the Login Widget is a browser script, so linking opens the web page. */
export function TelegramLinkCardNative() {
  const { token } = useAuth();
  const { connected, statusLoading, unlinkLoading, message, handleUnlink } = useTelegramLink(token);

  return (
    <CardNative title={Strings.settings.telegramCardTitle} subtitle={Strings.settings.telegramCardSubtitle}>
      {message ? <MessageNative text={message.text} isError={message.isError} /> : null}
      {statusLoading ? (
        <StatusLoading text={Strings.settings.telegramStatusLoading} />
      ) : connected ? (
        <StatusRow strong text={Strings.settings.telegramConnectedText}>
          <ButtonNative variant="danger" onPress={handleUnlink} loading={unlinkLoading}>
            {Strings.settings.telegramDisconnectButton}
          </ButtonNative>
        </StatusRow>
      ) : (
        <StatusRow text={Strings.settings.telegramNativeUnavailableText}>
          <ButtonNative onPress={() => openSettingsInBrowser('telegram_open_in_browser_clicked')}>
            {Strings.settings.telegramOpenInBrowserButton}
          </ButtonNative>
        </StatusRow>
      )}
    </CardNative>
  );
}
