import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { TeamList } from '@/features/teams';
import { SprintRetroBoard } from '@/features/retro';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/design/theme-context';
import { Button, Card, Page, PageHeader } from '@/components/ui';
import { useTeamsData } from '../hooks/use-teams-data';
import { subscribeGoHome } from '../home-signal';
import { trackEvent } from '@/lib/analytics';

export function DashboardWeb() {
  const t = useTheme();
  const { user, token } = useAuth();

  const [activeView, setActiveView] = useState<'dashboard' | 'retro'>('dashboard');
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { teams, isLoadingTeams, selectedTeam, setSelectedTeam, fetchMyTeams, refresh } = useTeamsData(token);

  useEffect(() => subscribeGoHome(() => {
    setActiveView('dashboard');
    setSelectedSprint(null);
    setSelectedTeam(null);
    if (token) fetchMyTeams(token);
  }), [token, fetchMyTeams, setSelectedTeam]);

  if (!user) return null;

  if (activeView === 'retro' && selectedSprint && selectedTeam) {
    return (
      <Box sx={{ flex: 1, minHeight: '100vh', backgroundColor: t.color.bg }}>
        <SprintRetroBoard
          sprint={selectedSprint}
          team={selectedTeam}
          token={token || ''}
          user={user}
          onBack={() => {
            setActiveView('dashboard');
            if (token) {
              fetchMyTeams(token);
            }
          }}
        />
      </Box>
    );
  }

  return (
    <Page>
      <PageHeader
        title={Strings.dashboard.welcomeTitle(user.firstName || user.username)}
        action={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            onPress={() => { trackEvent('refresh_clicked', { screen: 'dashboard' }); refresh(); }}
            disabled={isLoadingTeams}
          >
            {Strings.common.refreshButton}
          </Button>
        }
      />

      {errorMessage ? (
        <Alert severity="error" sx={{ ...t.type.body }}>
          {errorMessage}
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
      ) : teams.length === 0 ? (
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
          onSelectSprint={(sprint, team) => {
            setSelectedSprint(sprint);
            setSelectedTeam(team);
            setActiveView('retro');
          }}
        />
      )}
    </Page>
  );
}
