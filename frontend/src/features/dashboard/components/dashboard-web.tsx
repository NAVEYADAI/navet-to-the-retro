import React, { useState } from 'react';
import { router } from 'expo-router';
import { TeamList } from '@/features/teams';
import { SprintRetroBoard } from '@/features/retro';
import { Colors } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';
import { useTeamsData } from '../hooks/use-teams-data';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Fade,
  Grow,
} from '@mui/material';

export function DashboardWeb() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token } = useAuth();

  const [activeView, setActiveView] = useState<'dashboard' | 'retro'>('dashboard');
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { teams, isLoadingTeams, selectedTeam, setSelectedTeam, fetchMyTeams } = useTeamsData(token);

  if (!user) return null;

  const isDark = colorScheme === 'dark';
  const accent = isDark ? '#818cf8' : '#6366f1';

  if (activeView === 'retro' && selectedSprint && selectedTeam) {
    return (
      <Box sx={{ flex: 1, minHeight: '100vh', background: isDark
        ? 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.04) 0%, transparent 50%), #0a0a0f'
        : 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.04) 0%, transparent 50%), #fafbff' }}>
        <SprintRetroBoard
          sprint={selectedSprint}
          team={selectedTeam}
          token={token || ''}
          user={user}
          theme={themeColors}
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
    <Box sx={{
      minHeight: '100vh',
      background: isDark
        ? 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.04) 0%, transparent 50%), #0a0a0f'
        : 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.03) 0%, transparent 50%), #fafbff',
      pt: { xs: 14, md: 12 },
      pb: 6,
      direction: 'rtl',
    }}>
      <Container maxWidth="md" sx={{ mx: 'auto' }}>
        <Fade in={true} timeout={600}>
          <Box sx={{ mb: 5, textAlign: 'right' }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 800,
                color: themeColors.text,
                mb: 0.5,
                fontFamily: 'Rubik, sans-serif',
                letterSpacing: -0.5,
                animation: 'fadeInUp 0.5s ease both',
              }}
            >
              {Strings.dashboard.welcomeTitle(user.firstName || user.username)} 👋
            </Typography>
          </Box>
        </Fade>

        {!!errorMessage && (
          <Fade in={true}>
            <Alert
              severity="error"
              sx={{
                mb: 3,
                textAlign: 'right',
                flexDirection: 'row-reverse',
                borderRadius: '12px',
                fontFamily: 'Rubik, sans-serif',
              }}
            >
              {errorMessage}
            </Alert>
          </Fade>
        )}

        {isLoadingTeams ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
            <CircularProgress sx={{ color: accent }} />
            <Typography sx={{ color: themeColors.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
              {Strings.dashboard.loadingTeams}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ width: '100%' }}>
            {teams.length === 0 ? (
              <Grow in={true} timeout={500}>
                <Card sx={{
                  backgroundColor: isDark ? 'rgba(15,15,24,0.6)' : 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: '20px',
                  boxShadow: isDark
                    ? '0 12px 40px rgba(0,0,0,0.3)'
                    : '0 12px 40px rgba(0,0,0,0.04)',
                }}>
                  <CardContent sx={{ p: { xs: 4, sm: 5 }, textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 40, mb: 2 }}>🚀</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                      ברוך הבא!
                    </Typography>
                    <Typography variant="body2" sx={{ color: themeColors.textSecondary, lineHeight: 1.8, mb: 3, fontFamily: 'Rubik, sans-serif' }}>
                      אינך חבר באף צוות פיתוח עדיין. מנהלי צוותים יכולים להוסיף אותך לצוות שלהם לפי כתובת האימייל שלך, או שתוכל לעבור ללשונית "הגדרות" למעלה כדי ליצור צוות חדש משלך!
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => router.push('/settings')}
                      sx={{
                        background: `linear-gradient(135deg, ${accent} 0%, #8b5cf6 100%)`,
                        color: '#fff',
                        fontWeight: 700,
                        fontFamily: 'Rubik, sans-serif',
                        textTransform: 'none',
                        borderRadius: '12px',
                        py: 1.2,
                        px: 3,
                        boxShadow: `0 4px 16px rgba(99,102,241,0.25)`,
                        transition: 'all 0.25s ease',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: `0 8px 24px rgba(99,102,241,0.35)`,
                        },
                      }}
                    >
                      מעבר להגדרות ליצירת צוות ←
                    </Button>
                  </CardContent>
                </Card>
              </Grow>
            ) : (
              <Box sx={{ animation: 'fadeInUp 0.4s ease both' }}>
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
                  theme={themeColors}
                />
              </Box>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}
