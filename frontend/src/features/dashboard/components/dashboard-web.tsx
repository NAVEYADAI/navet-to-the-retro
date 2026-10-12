import React, { useEffect, useState } from 'react';
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
  // כל כרטיס מדווח כמה ספרינטים פעילים יש לו אחרי שטען אותם — לשורת הסיכום מתחת לכותרת.
  const [activeByTeam, setActiveByTeam] = useState<Record<number, number>>({});

  useEffect(() => subscribeGoHome(() => {
    setSelectedTeam(null);
    if (token) fetchMyTeams(token);
  }), [token, fetchMyTeams, setSelectedTeam]);

  if (!user) return null;

  const activeCounts = teams.map((team) => activeByTeam[team.id]).filter((n): n is number => n !== undefined);
  const subtitle = teams.length === 0
    ? undefined
    : [
        Strings.dashboard.teamsCount(teams.length),
        activeCounts.length > 0 ? Strings.teamList.summaryActiveSprints(activeCounts.reduce((a, b) => a + b, 0)) : null,
      ].filter(Boolean).join(' · ');

  return (
    <Page>
      <PageHeader
        title={Strings.teamList.myTeamsHeader}
        subtitle={subtitle}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
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
            {/* יצירת צוות גרה בהגדרות — הכפתור כאן רק מוביל אליה. */}
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onPress={() => { trackEvent('new_team_clicked', { screen: 'dashboard' }); router.push('/settings'); }}
            >
              {Strings.dashboard.newTeamButton}
            </Button>
          </Box>
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
          onActiveSprintCount={(teamId, count) =>
            setActiveByTeam((prev) => (prev[teamId] === count ? prev : { ...prev, [teamId]: count }))
          }
        />
      )}
    </Page>
  );
}
