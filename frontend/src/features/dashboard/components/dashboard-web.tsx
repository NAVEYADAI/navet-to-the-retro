import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { TeamList } from '@/features/teams';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/design/theme-context';
import { Button, Card, Page, PageHeader } from '@/components/ui';
import { useTeamsData } from '../hooks/use-teams-data';
import { subscribeGoHome } from '../home-signal';
import { openSprint } from '@/lib/sprint-routes';
import { trackEvent } from '@/lib/analytics';

export function DashboardWeb() {
  const t = useTheme();
  const { user, token } = useAuth();

  const { teams, isLoadingTeams, isRefreshing, loadError, setSelectedTeam, fetchMyTeams, refresh } = useTeamsData(token);

  useEffect(() => subscribeGoHome(() => {
    setSelectedTeam(null);
    if (token) fetchMyTeams(token);
  }), [token, fetchMyTeams, setSelectedTeam]);

  if (!user) return null;

  return (
    <Page>
      <PageHeader
        title={Strings.dashboard.welcomeTitle(user.firstName || user.username)}
        action={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            iconOnlyOnMobile
            onPress={() => { trackEvent('refresh_clicked', { screen: 'dashboard' }); refresh(); }}
            disabled={isLoadingTeams || isRefreshing}
          >
            {Strings.common.refreshButton}
          </Button>
        }
      />

      {loadError ? (
        <Alert severity="error" sx={{ ...t.type.body }}>
          {loadError}
        </Alert>
      ) : null}

      {isLoadingTeams ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: `${t.space[4]}px`,
            paddingBlock: `${t.space[7]}px`,
          }}
        >
          <CircularProgress sx={{ color: t.color.accent.base }} />
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
            {Strings.dashboard.loadingTeams}
          </Typography>
        </Box>
      ) : loadError && teams.length === 0 ? null : teams.length === 0 ? (
        <Card padding={6}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
            ברוך הבא!
          </Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary, maxWidth: 620 }}>
            אינך חבר באף צוות פיתוח עדיין. מנהלי צוותים יכולים להוסיף אותך לצוות שלהם לפי כתובת האימייל
            שלך, או שתוכל לעבור ללשונית "הגדרות" למעלה כדי ליצור צוות חדש משלך!
          </Typography>
          <Box>
            <Button variant="primary" onPress={() => router.push('/settings')}>
              מעבר להגדרות ליצירת צוות
            </Button>
          </Box>
        </Card>
      ) : (
        <TeamList
          teams={teams}
          token={token || ''}
          userId={user.id}
          onAddMemberSuccess={() => token && fetchMyTeams(token)}
          onSelectSprint={(sprint, team) => openSprint(team.id, sprint.id)}
        />
      )}
    </Page>
  );
}
