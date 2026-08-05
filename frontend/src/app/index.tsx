import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CreateTeamForm } from '@/components/create-team-form';
import { TeamList } from '@/components/team-list';
import { AccountDetails } from '@/components/account-details';
import { SprintRetroBoard } from '@/components/sprint-retro-board';
import { BottomTabInset, MaxContentWidth, Spacing, Colors } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';
import axios from 'axios';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Navigation / View states
  const [activeView, setActiveView] = useState<'dashboard' | 'retro'>('dashboard');
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  // Dashboard Data states
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [teamCreateLoading, setTeamCreateLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  useEffect(() => {
    if (token) {
      fetchMyTeams(token);
    }
  }, [token]);

  const fetchMyTeams = async (authToken: string) => {
    setIsLoadingTeams(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/user/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = response.data;
      setTeams(data);
      
      // Refresh selected team to keep data up-to-date when returning from updates
      if (selectedTeam) {
        const updatedTeam = data.find((t: any) => t.id === selectedTeam.id);
        if (updatedTeam) {
          setSelectedTeam(updatedTeam);
        }
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const handleCreateTeamSubmit = async (name: string, mainOffice: string) => {
    setErrorMessage(null);
    setTeamCreateLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams`, {
        name: name,
        mainOffice: mainOffice,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      setShowCreateTeam(false); // Collapse form after success
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

  /* View Router: Sprint Retro Board */
  if (activeView === 'retro' && selectedSprint && selectedTeam) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
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

  /* View Router: Dashboard */
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: isDesktop ? 80 : 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dashboardContainer}>
            {/* Header section */}
            <View style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                {Strings.dashboard.welcomeTitle(user.firstName || user.username)}
              </ThemedText>
              <ThemedText type="default" style={styles.subtitle}>
                {Strings.dashboard.welcomeSubtitle}
              </ThemedText>
            </View>

            {/* Error Message banner */}
            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}

            {isLoadingTeams ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.text} />
                <ThemedText type="default">{Strings.dashboard.loadingTeams}</ThemedText>
              </View>
            ) : teams.length === 0 ? (
              /* User has NO teams: show creation form in a centered card */
              <View style={[styles.centeredCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
                <CreateTeamForm
                  onSubmit={handleCreateTeamSubmit}
                  isLoading={teamCreateLoading}
                  isFirstTeam={true}
                  theme={theme}
                />
              </View>
            ) : (
              /* User HAS teams: show responsive dashboard grid */
              <View style={[styles.dashboardGrid, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                {/* Left Column: Create Team & Account Details */}
                <View style={[styles.leftColumn, { flex: isDesktop ? 1 : undefined }]}>
                  {showCreateTeam ? (
                    <View style={[styles.columnCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
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
                      style={[styles.toggleCreateBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                      onPress={() => setShowCreateTeam(true)}
                    >
                      <ThemedText style={{ fontWeight: 'bold', color: theme.text }}>
                        {Strings.dashboard.createNewTeamButton}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                  
                  <View style={[styles.columnCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
                    <AccountDetails
                      user={user}
                      theme={theme}
                    />
                  </View>
                </View>

                {/* Right Column: Teams List & Sprints */}
                <View style={[styles.rightColumn, { flex: isDesktop ? 2 : undefined }]}>
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
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 1100, // Gorgeous wide layout
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
