import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateTeamForm } from '@/features/teams';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { trackEvent } from '@/lib/analytics';
import { useProfileForm } from '../hooks/use-profile-form';
import { useTeamsAdmin } from '../hooks/use-teams-admin';
import { CardNative, ButtonNative, MessageNative, rnText } from './native/settings-native-parts';
import { ProfileFormCardNative } from './native/profile-form-card-native';
import { AppearanceCardNative } from './native/appearance-card-native';
import { GoogleCalendarCardNative, TelegramLinkCardNative } from './native/integration-cards-native';

/**
 * Native settings screen (BUG-09). The web screen is built on MUI, which doesn't run in React
 * Native — this is its RN-primitives counterpart, plus the logout button native users were missing
 * (on web it lives in the navbar).
 */
export function SettingsScreenNative() {
  const t = useTheme();
  const { user, token, login, logout } = useAuth();

  const profile = useProfileForm(user, token, login);
  const { teamCreateLoading, teamMessage, handleCreateTeamSubmit } = useTeamsAdmin(token);

  if (!user) return null;

  return (
    <View style={{ flex: 1, justifyContent: 'center', flexDirection: 'row', backgroundColor: t.color.bg }}>
      <SafeAreaView style={{ flex: 1, maxWidth: MaxContentWidth, width: '100%' }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: t.space[4],
            paddingTop: t.space[5],
            paddingBottom: BottomTabInset + t.space[4],
            width: '100%',
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 700, alignSelf: 'center', gap: t.space[4] }}>
            <View style={{ gap: t.space[1] }}>
              <Text style={[rnText(t.type.pageTitle), { color: t.color.text, textAlign: 'right' }]}>
                {Strings.settings.pageTitle}
              </Text>
              <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>
                {Strings.settings.pageSubtitle}
              </Text>
            </View>

            <ProfileFormCardNative
              firstName={profile.firstName}
              setFirstName={profile.setFirstName}
              lastName={profile.lastName}
              setLastName={profile.setLastName}
              email={profile.email}
              setEmail={profile.setEmail}
              profileLoading={profile.profileLoading}
              profileMessage={profile.profileMessage}
              onUpdateProfile={profile.handleUpdateProfile}
            />
            <AppearanceCardNative />
            <GoogleCalendarCardNative />
            <TelegramLinkCardNative />

            <CardNative title={Strings.settings.createTeamSectionTitle}>
              {teamMessage ? <MessageNative text={teamMessage.text} isError={teamMessage.isError} /> : null}
              <CreateTeamForm onSubmit={handleCreateTeamSubmit} isLoading={teamCreateLoading} isFirstTeam={false} />
            </CardNative>

            <CardNative title={Strings.settings.logoutSectionTitle} subtitle={Strings.settings.logoutDescription}>
              <ButtonNative
                variant="danger"
                testID="settings-logout-button"
                onPress={() => {
                  trackEvent('logout_clicked', { source: 'settings_native' });
                  void logout();
                }}
              >
                {Strings.settings.logoutButton}
              </ButtonNative>
            </CardNative>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
