import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token, logout } = useAuth();

  // State
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [newMainOffice, setNewMainOffice] = useState('');
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
      const response = await fetch(`${getBackendUrl()}/teams/user/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const handleCreateTeam = async () => {
    setErrorMessage(null);
    if (!newTeamName.trim()) {
      setErrorMessage('Team name is required.');
      return;
    }

    setTeamCreateLoading(true);
    try {
      const response = await fetch(`${getBackendUrl()}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTeamName,
          mainOffice: newMainOffice,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create team');
      }

      setNewTeamName('');
      setNewMainOffice('');
      if (token) {
        await fetchMyTeams(token);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong.');
    } finally {
      setTeamCreateLoading(false);
    }
  };

  if (!user) return null;

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
            {errorMessage && (
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
              /* User has NO teams: show creation workspace */
              <View style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="subtitle" style={styles.sectionHeader}>
                  Create your first development team
                </ThemedText>
                <ThemedText type="default" style={styles.sectionDescription}>
                  You don't belong to any development team yet. Create one below to start collecting retro notes.
                </ThemedText>

                <View style={styles.form}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        borderColor: theme.backgroundSelected,
                        backgroundColor: theme.background,
                      },
                    ]}
                    placeholder="Team Name (e.g. R&D Core)"
                    placeholderTextColor={theme.textSecondary}
                    value={newTeamName}
                    onChangeText={setNewTeamName}
                  />

                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        borderColor: theme.backgroundSelected,
                        backgroundColor: theme.background,
                      },
                    ]}
                    placeholder="Main Office / Headquarters (Optional)"
                    placeholderTextColor={theme.textSecondary}
                    value={newMainOffice}
                    onChangeText={setNewMainOffice}
                  />

                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.text }]}
                    onPress={handleCreateTeam}
                    disabled={teamCreateLoading}
                  >
                    {teamCreateLoading ? (
                      <ActivityIndicator color={theme.background} />
                    ) : (
                      <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                        Create Team (Team Leader)
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* User HAS teams: show team details */
              <View style={styles.teamsList}>
                <ThemedText type="subtitle" style={styles.sectionHeader}>
                  My Teams
                </ThemedText>
                {teams.map((team) => (
                  <View
                    key={team.id}
                    style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}
                  >
                    <View style={styles.teamHeaderRow}>
                      <ThemedText type="subtitle" style={{ fontWeight: 'bold' }}>
                        {team.name}
                      </ThemedText>
                      <View style={[styles.roleBadge, { backgroundColor: theme.backgroundSelected }]}>
                        <ThemedText style={[styles.roleText, { color: theme.text }]}>
                          {team.roleInTeam.replace('_', ' ')}
                        </ThemedText>
                      </View>
                    </View>

                    {team.mainOffice && (
                      <View style={styles.infoRow}>
                        <ThemedText type="default" style={{ fontWeight: 'bold' }}>
                          Office Location:{' '}
                        </ThemedText>
                        <ThemedText type="default">{team.mainOffice}</ThemedText>
                      </View>
                    )}

                    <View style={styles.membersContainer}>
                      <ThemedText type="default" style={{ fontWeight: 'bold', marginBottom: Spacing.one }}>
                        Members ({team.members?.length || 0}):
                      </ThemedText>
                      {team.members?.map((member: any) => (
                        <View key={member.id} style={styles.memberItem}>
                          <ThemedText type="default">
                            • {member.user?.firstName} {member.user?.lastName} (@{member.user?.username})
                          </ThemedText>
                          <ThemedText type="code" style={{ fontSize: 11, opacity: 0.8 }}>
                            [{member.role.replace('_', ' ')}]
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Account Details footer */}
            <View style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="subtitle" style={styles.sectionHeader}>
                Account Details
              </ThemedText>
              <View style={styles.infoRow}>
                <ThemedText type="default" style={{ fontWeight: 'bold' }}>Username: </ThemedText>
                <ThemedText type="default">{user.username}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText type="default" style={{ fontWeight: 'bold' }}>Email: </ThemedText>
                <ThemedText type="default">{user.email}</ThemedText>
              </View>
            </View>

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
  infoSection: {
    padding: Spacing.three,
    borderRadius: 10,
    gap: Spacing.two,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  sectionDescription: {
    opacity: 0.8,
    marginBottom: Spacing.two,
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: Spacing.two,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  loadingContainer: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  teamsList: {
    gap: Spacing.three,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  membersContainer: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
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
