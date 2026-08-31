import React from 'react';
import { router } from 'expo-router';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  Fade,
  Grow,
} from '@mui/material';
import { Button } from '@/components/ui';
import { CreateTeamForm } from '@/features/teams';
import { ProfileFormCard, AppearanceCard, AdminTeamsCard } from '@/features/settings';
import { useProfileForm } from '@/features/settings/hooks/use-profile-form';
import { useTeamsAdmin } from '@/features/settings/hooks/use-teams-admin';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';

export default function SettingsScreen() {
  const t = useTheme();
  const themeColors = Colors[t.mode];
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

  const isDark = t.mode === 'dark';
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
      backgroundColor: t.color.bg,
      pt: `${t.space[6]}px`,
      pb: `${t.space[6]}px`,
      direction: 'rtl',
    }}>
      <Container maxWidth={false} sx={{ maxWidth: `${t.layout.container}px`, px: { xs: 2, sm: 3 }, mx: 'auto' }}>
        {/* Header section (Responsive RTL) */}
        <Fade in={true} timeout={500}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column-reverse', sm: 'row' },
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

            <Button variant="secondary" onPress={() => router.push('/')}>
              ← חזרה לראשי
            </Button>
          </Box>
        </Fade>

        {/* Content grid */}
        <Grid container spacing={4} direction={{ xs: 'column', md: 'row-reverse' } as any}>
          
          {/* Left Column: Personal details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
              />
              <AppearanceCard />
            </Box>
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
            />
          </Grid>

        </Grid>
      </Container>
    </Box>
  );
}
