import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
import { CreateTeamForm, TeamList } from '@/features/teams';
import { AccountDetails } from '@/components/account-details';
import { SprintRetroBoard } from '@/features/retro';
import { BottomTabInset, MaxContentWidth, Spacing, Colors } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';
import { apiClient } from '@/api/client';
import { getBackendUrl } from '@/api/config';
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
            <Typography sx={{
              color: themeColors.textSecondary,
              fontFamily: 'Rubik, sans-serif',
              fontSize: 15,
              animation: 'fadeInUp 0.6s ease both',
              animationDelay: '0.1s',
            }}>
              ברוך הבא לפורטל הרטרוספקטיבה של הצוותים שלך.
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
