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
import { router } from 'expo-router';
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
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Fade,
  Grow,
} from '@mui/material';

export default function HomeScreen() {
  if (Platform.OS === 'web') {
    return <HomeScreenWeb />;
  }
  return <HomeScreenNative />;
}

/* 1. WEB VERSION (Material UI + Smooth entry transitions) */
function HomeScreenWeb() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token } = useAuth();
  
  const [activeView, setActiveView] = useState<'dashboard' | 'retro'>('dashboard');
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  const [teams, setTeams] = useState<any[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getBackendUrl = () => {
    return typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
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

  if (!user) return null;

  if (activeView === 'retro' && selectedSprint && selectedTeam) {
    return (
      <Box sx={{ flex: 1, backgroundColor: themeColors.background, minHeight: '100vh' }}>
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
    <Box sx={{ minHeight: '100vh', backgroundColor: themeColors.background, pt: { xs: 14, md: 12 }, pb: 6, direction: 'rtl' }}>
      <Container maxWidth="md" sx={{ mx: 'auto' }}>
        <Fade in={true} timeout={600}>
          <Box sx={{ mb: 4, textAlign: 'right' }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: themeColors.text, mb: 1, fontFamily: 'Rubik, sans-serif' }}>
              {Strings.dashboard.welcomeTitle(user.firstName || user.username)}
            </Typography>
            <Typography variant="body1" sx={{ color: themeColors.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
              ברוך הבא לפורטל הרטרוספקטיבה של הצוותים שלך.
            </Typography>
          </Box>
        </Fade>

        {!!errorMessage && (
          <Fade in={true}>
            <Alert severity="error" sx={{ mb: 3, textAlign: 'right', flexDirection: 'row-reverse' }}>
              {errorMessage}
            </Alert>
          </Fade>
        )}

        {isLoadingTeams ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
            <CircularProgress color="inherit" sx={{ color: themeColors.text }} />
            <Typography sx={{ color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
              {Strings.dashboard.loadingTeams}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ width: '100%' }}>
            {teams.length === 0 ? (
              <Grow in={true} timeout={500}>
                <Card sx={{ backgroundColor: themeColors.backgroundElement, borderColor: themeColors.backgroundSelected, borderWidth: 1, borderStyle: 'solid', borderRadius: 4, boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                  <CardContent sx={{ p: 4, textAlign: 'right' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                      ברוך הבא!
                    </Typography>
                    <Typography variant="body2" sx={{ color: themeColors.textSecondary, lineHeight: 1.6, mb: 3, fontFamily: 'Rubik, sans-serif' }}>
                      אינך חבר באף צוות פיתוח עדיין. מנהלי צוותים יכולים להוסיף אותך לצוות שלהם לפי שם המשתמש שלך (@{user.username}), או שתוכל לעבור ללשונית "הגדרות" למעלה כדי ליצור צוות חדש משלך!
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => router.push('/settings')}
                      sx={{
                        backgroundColor: themeColors.text,
                        color: themeColors.background,
                        fontWeight: 'bold',
                        fontFamily: 'Rubik, sans-serif',
                        textTransform: 'none',
                        borderRadius: 2,
                        '&:hover': { backgroundColor: themeColors.textSecondary }
                      }}
                    >
                      מעבר להגדרות ליצירת צוות ←
                    </Button>
                  </CardContent>
                </Card>
              </Grow>
            ) : (
              <Grow in={true} timeout={500}>
                <Box>
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
              </Grow>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}

/* 2. NATIVE VERSION (React Native - fully RTL & Jest compatible) */
function HomeScreenNative() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeView, setActiveView] = useState<'dashboard' | 'retro'>('dashboard');
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

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
