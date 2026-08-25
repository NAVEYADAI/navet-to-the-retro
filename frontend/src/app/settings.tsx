import React from 'react';
import { router } from 'expo-router';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  Fade,
  Grow,
} from '@mui/material';
import { CreateTeamForm } from '@/features/teams';
import { ProfileFormCard, AdminTeamsCard } from '@/features/settings';
import { useProfileForm } from '@/features/settings/hooks/use-profile-form';
import { useTeamsAdmin } from '@/features/settings/hooks/use-teams-admin';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token, login } = useAuth();

  const {
    firstName, setFirstName,
    lastName, setLastName,
    email, setEmail,
    profileLoading,
    profileMessage,
    handleUpdateProfile,
  } = useProfileForm(user, token, login);

  const {
    adminTeams,
    loadingTeams,
    teamCreateLoading,
    teamMessage,
    handleCreateTeamSubmit,
    editTeamId, setEditTeamId,
    editTeamName, setEditTeamName,
    editTeamOffice, setEditTeamOffice,
    teamEditLoading,
    teamEditMessage, setTeamEditMessage,
    handleSaveTeamEdit,
  } = useTeamsAdmin(token, user);

  if (!user) return null;

  const isDark = colorScheme === 'dark';
  const accent = isDark ? '#818cf8' : '#6366f1';

  const cardSx = {
    backgroundColor: isDark ? 'rgba(15,15,24,0.6)' : 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(12px)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    borderRadius: '20px',
    boxShadow: isDark
      ? '0 8px 32px rgba(0,0,0,0.3)'
      : '0 8px 32px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.3s ease, transform 0.3s ease',
    '&:hover': {
      boxShadow: isDark
        ? '0 12px 40px rgba(0,0,0,0.4)'
        : '0 12px 40px rgba(0,0,0,0.06)',
    },
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: isDark
        ? 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.04) 0%, transparent 50%), #0a0a0f'
        : 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.03) 0%, transparent 50%), #fafbff',
      pt: { xs: 13, md: 12 },
      pb: 6,
      direction: 'rtl',
    }}>
      <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 }, mx: 'auto' }}>
        {/* Header section (Responsive RTL) */}
        <Fade in={true} timeout={500}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column-reverse', sm: 'row-reverse' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 2.5, sm: 2 },
              mb: 5,
              pb: 3,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Box sx={{ textAlign: 'right', flex: 1 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 800,
                  color: themeColors.text,
                  fontFamily: 'Rubik, sans-serif',
                  letterSpacing: -0.5,
                  fontSize: { xs: '1.5rem', sm: '2.1rem' },
                }}
              >
                ⚙️ הגדרות מערכת
              </Typography>
              <Typography
                sx={{
                  color: themeColors.textSecondary,
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: { xs: 13, sm: 14 },
                  mt: 0.5,
                }}
              >
                ניהול פרטים אישיים, צוותים ואפשרויות מערכת נוספות.
              </Typography>
            </Box>

            <Button
              variant="outlined"
              onClick={() => router.push('/')}
              sx={{
                alignSelf: { xs: 'flex-start', sm: 'center' },
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                color: themeColors.text,
                fontWeight: 700,
                fontFamily: 'Rubik, sans-serif',
                textTransform: 'none',
                borderRadius: '14px',
                px: 3,
                py: 1,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.25s ease',
                '&:hover': {
                  borderColor: accent,
                  backgroundColor: `${accent}12`,
                  color: accent,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 14px ${accent}25`,
                },
              }}
            >
              ← חזרה לראשי
            </Button>
          </Box>
        </Fade>

        {/* Content grid */}
        <Grid container spacing={4} direction={{ xs: 'column', md: 'row-reverse' } as any}>
          
          {/* Left Column: Personal details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <ProfileFormCard
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              email={email}
              setEmail={setEmail}
              profileLoading={profileLoading}
              profileMessage={profileMessage}
              onUpdateProfile={handleUpdateProfile}
              isDark={isDark}
              accent={accent}
              themeColors={themeColors}
            />
          </Grid>

          {/* Right Column: Create Team */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Grow in={true} timeout={500}>
              <Card sx={cardSx}>
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                    🏗️ יצירת צוות חדש
                  </Typography>

                  {teamMessage && (
                    <Fade in={true}>
                      <Alert
                        severity={teamMessage.isError ? 'error' : 'success'}
                        sx={{ flexDirection: 'row-reverse', textAlign: 'right', borderRadius: '12px', fontFamily: 'Rubik, sans-serif' }}
                      >
                        {teamMessage.text}
                      </Alert>
                    </Fade>
                  )}

                  <CreateTeamForm
                    onSubmit={handleCreateTeamSubmit}
                    isLoading={teamCreateLoading}
                    isFirstTeam={false}
                    theme={themeColors}
                  />
                </CardContent>
              </Card>
            </Grow>
          </Grid>

          {/* Bottom Column: Manage & Edit existing teams */}
          <Grid size={{ xs: 12 }}>
            <AdminTeamsCard
              adminTeams={adminTeams}
              loadingTeams={loadingTeams}
              editTeamId={editTeamId}
              setEditTeamId={setEditTeamId}
              editTeamName={editTeamName}
              setEditTeamName={setEditTeamName}
              editTeamOffice={editTeamOffice}
              setEditTeamOffice={setEditTeamOffice}
              teamEditLoading={teamEditLoading}
              teamEditMessage={teamEditMessage}
              setTeamEditMessage={setTeamEditMessage}
              onSaveTeamEdit={handleSaveTeamEdit}
              isDark={isDark}
              themeColors={themeColors}
            />
          </Grid>

        </Grid>
      </Container>
    </Box>
  );
}
