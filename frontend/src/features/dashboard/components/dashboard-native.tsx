import React, { useState } from 'react';
import axios from 'axios';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CreateTeamForm, TeamList } from '@/features/teams';
import { SprintRetroBoard } from '@/features/retro';
import { BottomTabInset, MaxContentWidth, Spacing, Colors } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';
import { getBackendUrl } from '@/api/config';
import { useTeamsData } from '../hooks/use-teams-data';

export function DashboardNative() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeView, setActiveView] = useState<'dashboard' | 'retro'>('dashboard');
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [teamCreateLoading, setTeamCreateLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const { teams, isLoadingTeams, selectedTeam, setSelectedTeam, fetchMyTeams } = useTeamsData(token);

  const handleCreateTeamSubmit = async (name: string, mainOffice: string, approverEmail: string) => {
    setErrorMessage(null);
    setTeamCreateLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams`, {
        name: name,
        mainOffice: mainOffice,
        approverEmail: approverEmail,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      setShowCreateTeam(false);
      if (token) {
        await fetchMyTeams(token);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'שגיאה ביצירת הצוות.');
      throw err;
    } finally {
      setTeamCreateLoading(false);
    }
  };

  if (!user) return null;

  if (activeView === 'retro' && selectedSprint && selectedTeam) {
    return (
      <ThemedView style={nativeStyles.container}>
        <SafeAreaView style={nativeStyles.safeArea}>
          <SprintRetroBoard
            sprint={selectedSprint}
            team={selectedTeam}
            token={token || ''}
            user={user}
            theme={theme}
            onBack={() => {
              setActiveView('dashboard');
              if (token) {
                fetchMyTeams(token);
              }
            }}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={nativeStyles.container}>
      <SafeAreaView style={nativeStyles.safeArea}>
        <ScrollView
          contentContainerStyle={[nativeStyles.scrollContent, { paddingTop: isDesktop ? 80 : 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={nativeStyles.dashboardContainer}>
            <View style={nativeStyles.header}>
              <ThemedText type="title" style={nativeStyles.title}>
                {Strings.dashboard.welcomeTitle(user.firstName || user.username)}
              </ThemedText>
              <ThemedText type="default" style={nativeStyles.subtitle}>
                {Strings.dashboard.welcomeSubtitle}
              </ThemedText>
            </View>

            {!!errorMessage && (
              <View style={nativeStyles.errorBanner}>
                <ThemedText style={nativeStyles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}

            {isLoadingTeams ? (
              <View style={nativeStyles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.text} />
                <ThemedText type="default">{Strings.dashboard.loadingTeams}</ThemedText>
              </View>
            ) : teams.length === 0 ? (
              <View style={[nativeStyles.centeredCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
                <CreateTeamForm
                  onSubmit={handleCreateTeamSubmit}
                  isLoading={teamCreateLoading}
                  isFirstTeam={true}
                  theme={theme}
                />
              </View>
            ) : (
              <View style={{ width: '100%', gap: Spacing.four }}>
                {showCreateTeam ? (
                  <View style={[nativeStyles.columnCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
                    <CreateTeamForm
                      onSubmit={handleCreateTeamSubmit}
                      isLoading={teamCreateLoading}
                      isFirstTeam={false}
                      onCancel={() => setShowCreateTeam(false)}
                      theme={theme}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[nativeStyles.toggleCreateBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                    onPress={() => setShowCreateTeam(true)}
                  >
                    <ThemedText style={{ fontWeight: 'bold', color: theme.text }}>
                      {Strings.dashboard.createNewTeamButton}
                    </ThemedText>
                  </TouchableOpacity>
                )}

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
                  theme={theme}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const nativeStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    width: '100%',
  },
  dashboardContainer: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    opacity: 0.7,
  },
  centeredCard: {
    width: '100%',
    maxWidth: 480,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignSelf: 'center',
  },
  dashboardGrid: {
    gap: Spacing.four,
    width: '100%',
  },
  leftColumn: {
    width: '100%',
    gap: Spacing.four,
  },
  rightColumn: {
    width: '100%',
    gap: Spacing.four,
  },
  columnCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    width: '100%',
  },
  loadingContainer: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  toggleCreateBtn: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderStyle: 'dashed',
  },
});
