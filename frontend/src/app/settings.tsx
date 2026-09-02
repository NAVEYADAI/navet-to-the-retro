import React from 'react';
import { router } from 'expo-router';
import { Box, Typography, Alert } from '@mui/material';
import { Button, Card, Page, PageHeader, Grid } from '@/components/ui';
import { CreateTeamForm } from '@/features/teams';
import { ProfileFormCard, AppearanceCard, AdminTeamsCard } from '@/features/settings';
import { useProfileForm } from '@/features/settings/hooks/use-profile-form';
import { useTeamsAdmin } from '@/features/settings/hooks/use-teams-admin';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { Strings } from '@/constants/strings';

export default function SettingsScreen() {
  const t = useTheme();
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
    fetchAdminTeams,
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

  return (
    <Page>
      <PageHeader
        title={Strings.settings.pageTitle}
        subtitle={Strings.settings.pageSubtitle}
        action={<Button variant="secondary" onPress={() => router.push('/')}>{Strings.settings.backToHomeButton}</Button>}
      />

      <Grid columns={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[4]}px` }}>
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

        <Card padding={5}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
            {Strings.settings.createTeamSectionTitle}
          </Typography>

          {teamMessage && (
            <Alert severity={teamMessage.isError ? 'error' : 'success'} sx={{ ...t.type.body }}>
              {teamMessage.text}
            </Alert>
          )}

          <CreateTeamForm
            onSubmit={handleCreateTeamSubmit}
            isLoading={teamCreateLoading}
            isFirstTeam={false}
          />
        </Card>
      </Grid>

      <AdminTeamsCard
        adminTeams={adminTeams}
        loadingTeams={loadingTeams}
        onRefresh={fetchAdminTeams}
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
    </Page>
  );
}
