import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Card, Page } from '@/components/ui';

export function FocusRouteStateWeb({ status, onRetry, onBack }: { status: 'loading' | 'notFound' | 'error'; onRetry: () => void; onBack: () => void }) {
  const t = useTheme();
  if (status === 'loading') {
    return (
      <Page>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${t.space[4]}px`, paddingBlock: `${t.space[7]}px` }}>
          <CircularProgress sx={{ color: t.color.accent.base }} />
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{Strings.focusPoints.loading}</Typography>
        </Box>
      </Page>
    );
  }
  return (
    <Page>
      <Card padding={6}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
          {status === 'notFound' ? Strings.focusPoints.routeNotFound : Strings.focusPoints.loadError}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
          {status === 'error' ? <Button variant="secondary" icon="refresh" onPress={onRetry}>{Strings.sprintRoute.retryButton}</Button> : null}
          <Button variant="ghost" onPress={onBack}>{Strings.sprintRoute.backToDashboardButton}</Button>
        </Box>
      </Card>
    </Page>
  );
}
