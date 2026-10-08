import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Card, Button } from '@/components/ui';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import { useGoogleCalendar } from '../hooks/use-google-calendar';

/** חיבור אישי ליומן Google (product-backlog/06-google-calendar-integration.md §6) — כל חבר צוות מחבר/מנתק רק את החיבור שלו. */
export function GoogleCalendarCard() {
  const t = useTheme();
  const { token } = useAuth();
  const {
    connected,
    googleAccountEmail,
    statusLoading,
    statusError,
    connectLoading,
    disconnectLoading,
    message,
    handleConnect,
    handleDisconnect,
  } = useGoogleCalendar(token);

  return (
    <Card padding={5}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
          {Strings.settings.googleCalendarCardTitle}
        </Typography>
        <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
          {Strings.settings.googleCalendarCardSubtitle}
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
            {Strings.settings.googleCalendarStatusLoading}
          </Typography>
        </Box>
      ) : statusError ? null : connected ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
          <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, minWidth: 0 }}>
            {Strings.settings.googleCalendarConnectedLabel(googleAccountEmail || '')}
          </Typography>
          <Button
            variant="danger"
            size="sm"
            onPress={handleDisconnect}
            disabled={disconnectLoading}
            loading={disconnectLoading}
          >
            {Strings.settings.googleCalendarDisconnectButton}
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>
            {Strings.settings.googleCalendarNotConnectedText}
          </Typography>
          <Button
            variant="secondary"
            size="sm"
            onPress={handleConnect}
            disabled={connectLoading}
            loading={connectLoading}
          >
            {Strings.settings.googleCalendarConnectButton}
          </Button>
        </Box>
      )}
    </Card>
  );
}
