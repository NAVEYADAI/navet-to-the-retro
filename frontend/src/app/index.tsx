import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CreateTeamForm } from '@/components/create-team-form';
import { TeamList } from '@/components/team-list';
import { AccountDetails } from '@/components/account-details';
import { SprintRetroBoard } from '@/components/sprint-retro-board';
import { BottomTabInset, MaxContentWidth, Spacing, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';
import axios from 'axios';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token, logout } = useAuth();

  // Navigation / View states
  const [activeView, setActiveView] = useState<'dashboard' | 'retro'>('dashboard');
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  // Dashboard Data states
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [teamCreateLoading, setTeamCreateLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      if (token) {
        await fetchMyTeams(token);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Something went wrong.');
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.contentCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
            {/* Header section */}
            <View style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                Welcome, {user.firstName || user.username}!
              </ThemedText>
              <ThemedText type="default" style={styles.subtitle}>
                You have successfully logged in to the Retro system.
              </ThemedText>
            </View>

            {/* Error Message banner */}
            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
              </View>
            )}

            {/* Main content body */}
            {isLoadingTeams ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.text} />
                <ThemedText type="default">Loading your teams...</ThemedText>
              </View>
            ) : teams.length === 0 ? (
              /* User has NO teams: show creation form */
              <CreateTeamForm
                onSubmit={handleCreateTeamSubmit}
                isLoading={teamCreateLoading}
                theme={theme}
              />
            ) : (
              /* User HAS teams: show team list */
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
            )}

            {/* Account Details section */}
            <AccountDetails
              user={user}
              theme={theme}
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#e53935' }]}
              onPress={logout}
            >
              <ThemedText style={styles.buttonText}>Log Out</ThemedText>
            </TouchableOpacity>
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    alignItems: 'center',
  },
  contentCard: {
    width: '100%',
    maxWidth: 450,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    textAlign: 'center',
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: Spacing.one,
  },
  button: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
});
