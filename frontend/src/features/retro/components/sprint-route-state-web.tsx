import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Card, Page } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import type { SprintRouteStatus } from '../hooks/use-sprint-route-data';

interface Props {
  status: Exclude<SprintRouteStatus, 'ready'>;
  onRetry: () => void;
  onBackToDashboard: () => void;
}

/** Loading / not-found / error placeholder shown while a sprint route resolves its sprint + team. */
export function SprintRouteStateWeb({ status, onRetry, onBackToDashboard }: Props) {
  const t = useTheme();

  if (status === 'loading') {
    return (
      <Page>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${t.space[4]}px`, paddingBlock: `${t.space[7]}px` }}>
          <CircularProgress sx={{ color: t.color.accent.base }} />
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{Strings.sprintRoute.loading}</Typography>
        </Box>
      </Page>
    );
  }

  const isNotFound = status === 'notFound';
  return (
    <Page>
      <Card padding={6}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
          {isNotFound ? Strings.sprintRoute.notFoundTitle : Strings.sprintRoute.loadError}
        </Typography>
        {isNotFound ? (
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{Strings.sprintRoute.notFoundText}</Typography>
        ) : null}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
          {isNotFound ? null : (
            <Button
              variant="secondary"
              icon="refresh"
              onPress={() => { trackEvent('sprint_route_retry_clicked'); onRetry(); }}
            >
              {Strings.sprintRoute.retryButton}
            </Button>
          )}
          <Button
            variant="ghost"
            onPress={() => { trackEvent('sprint_route_back_to_dashboard_clicked', { status }); onBackToDashboard(); }}
          >
            {Strings.sprintRoute.backToDashboardButton}
          </Button>
        </Box>
      </Card>
    </Page>
  );
}
