import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Fade,
  Grow,
} from '@mui/material';
import { CreateTeamForm } from '@/components/create-team-form';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';
import axios from 'axios';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token, login } = useAuth();

  // Personal details states
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Create Team states
  const [teamCreateLoading, setTeamCreateLoading] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Edit Team states
  const [adminTeams, setAdminTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [editTeamId, setEditTeamId] = useState<number | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamOffice, setEditTeamOffice] = useState('');
  const [teamEditLoading, setTeamEditLoading] = useState(false);
  const [teamEditMessage, setTeamEditMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const fetchAdminTeams = async () => {
    if (!token || !user) return;
    setLoadingTeams(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/user/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const myAdminTeams = response.data.filter((t: any) =>
        t.members?.some((m: any) => m.userId === user.id && m.isAdmin)
      );
      setAdminTeams(myAdminTeams);
    } catch (err) {
      console.error('Failed to fetch admin teams:', err);
    } finally {
      setLoadingTeams(false);
    }
  };

  useEffect(() => {
    fetchAdminTeams();
  }, [token]);

  const handleUpdateProfile = async () => {
    setProfileMessage(null);
    if (!email.trim()) {
      setProfileMessage({ text: 'כתובת אימייל היא שדה חובה.', isError: true });
      return;
    }

    setProfileLoading(true);
    try {
      const response = await axios.patch(
        `${getBackendUrl()}/auth/profile`,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      // Update local auth context user object
      if (token) {
        await login(token, response.data);
      }
      setProfileMessage({ text: 'הפרטים האישיים עודכנו בהצלחה!', isError: false });
    } catch (err: any) {
      setProfileMessage({
        text: err.response?.data?.message || err.message || 'שגיאה בעדכון הפרטים.',
        isError: true,
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreateTeamSubmit = async (name: string, mainOffice: string) => {
    setTeamMessage(null);
    setTeamCreateLoading(true);
    try {
      await axios.post(
        `${getBackendUrl()}/teams`,
        {
          name: name,
          mainOffice: mainOffice,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      setTeamMessage({ text: `הצוות "${name}" נוצר בהצלחה!`, isError: false });
      fetchAdminTeams();
    } catch (err: any) {
      setTeamMessage({
        text: err.response?.data?.message || err.message || 'שגיאה ביצירת הצוות.',
        isError: true,
      });
      throw err;
    } finally {
      setTeamCreateLoading(false);
    }
  };

  const handleSaveTeamEdit = async (teamId: number) => {
    if (!editTeamName.trim()) {
      setTeamEditMessage({ text: 'שם צוות הוא שדה חובה.', isError: true });
      return;
    }
    setTeamEditLoading(true);
    setTeamEditMessage(null);
    try {
      await axios.patch(
        `${getBackendUrl()}/teams/${teamId}`,
        {
          name: editTeamName.trim(),
          mainOffice: editTeamOffice.trim(),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      setTeamEditMessage({ text: 'פרטי הצוות עודכנו בהצלחה!', isError: false });
      setEditTeamId(null);
      fetchAdminTeams();
    } catch (err: any) {
      setTeamEditMessage({
        text: err.response?.data?.message || err.message || 'שגיאה בעדכון הצוות.',
        isError: true,
      });
    } finally {
      setTeamEditLoading(false);
    }
  };

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

  const inputSx = {
    input: { color: themeColors.text, textAlign: 'right', fontFamily: 'Rubik, sans-serif' },
    label: { color: themeColors.textSecondary, right: 28, left: 'auto' },
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      transition: 'all 0.2s ease',
      '&:hover fieldset': { borderColor: accent },
      '&.Mui-focused fieldset': { borderColor: accent, borderWidth: 2 },
      fieldset: { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
    },
  };

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
        {/* Header section (RTL) */}
        <Fade in={true} timeout={500}>
          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 800,
                  color: themeColors.text,
                  fontFamily: 'Rubik, sans-serif',
                  letterSpacing: -0.5,
                  animation: 'fadeInUp 0.5s ease both',
                }}
              >
                ⚙️ הגדרות מערכת
              </Typography>
              <Typography sx={{ color: themeColors.textSecondary, fontFamily: 'Rubik, sans-serif', fontSize: 14, mt: 0.5 }}>
                ניהול פרטים אישיים, צוותים ואפשרויות נוספות.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => router.push('/')}
              sx={{
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                color: themeColors.text,
                fontWeight: 700,
                fontFamily: 'Rubik, sans-serif',
                textTransform: 'none',
                borderRadius: '12px',
                px: 2.5,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: accent,
                  backgroundColor: `${accent}08`,
                  color: accent,
                },
              }}
            >
              ← חזרה לראשי
            </Button>
          </Box>
        </Fade>

        {/* Content grid */}
        <Grid container spacing={4} direction={{ xs: 'column', md: 'row-reverse' }}>
          
          {/* Left Column: Personal details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Grow in={true} timeout={400}>
              <Card sx={cardSx}>
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                    👤 עדכון פרטים אישיים
                  </Typography>

                  {profileMessage && (
                    <Fade in={true}>
                      <Alert
                        severity={profileMessage.isError ? 'error' : 'success'}
                        sx={{ flexDirection: 'row-reverse', textAlign: 'right', borderRadius: '12px', fontFamily: 'Rubik, sans-serif' }}
                      >
                        {profileMessage.text}
                      </Alert>
                    </Fade>
                  )}

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TextField
                      label="שם פרטי"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={inputSx}
                    />
                    <TextField
                      label="שם משפחה"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={inputSx}
                    />
                    <TextField
                      label="כתובת אימייל"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={inputSx}
                    />
                  </Box>

                  <Button
                    variant="contained"
                    onClick={handleUpdateProfile}
                    disabled={profileLoading}
                    sx={{
                      background: `linear-gradient(135deg, ${accent} 0%, #8b5cf6 100%)`,
                      color: '#fff',
                      fontWeight: 700,
                      fontFamily: 'Rubik, sans-serif',
                      textTransform: 'none',
                      borderRadius: '12px',
                      py: 1.2,
                      boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
                      transition: 'all 0.25s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
                      },
                      '&.Mui-disabled': {
                        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      },
                    }}
                  >
                    {profileLoading ? (
                      <CircularProgress size={22} sx={{ color: '#fff' }} />
                    ) : (
                      'שמור שינויים'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </Grow>
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
            <Grow in={true} timeout={600}>
              <Card
                sx={{ ...cardSx, mt: 2 }}
              >
                <CardContent sx={{ p: 4, textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                    🛠️ ניהול ועריכת צוותים בניהולך
                  </Typography>

                  {teamEditMessage && (
                    <Alert
                      severity={teamEditMessage.isError ? 'error' : 'success'}
                      sx={{ flexDirection: 'row-reverse', textAlign: 'right', mb: 3 }}
                    >
                      {teamEditMessage.text}
                    </Alert>
                  )}

                  {loadingTeams ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress color="inherit" sx={{ color: themeColors.text }} />
                    </Box>
                  ) : adminTeams.length === 0 ? (
                    <Typography sx={{ color: themeColors.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                      אינך מנהל של אף צוות במערכת כרגע.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {adminTeams.map((team) => {
                        const isEditing = editTeamId === team.id;
                        return (
                          <Box
                            key={team.id}
                            sx={{
                              p: 2.5,
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.06)',
                              backgroundColor: themeColors.background,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2
                            }}
                          >
                            {isEditing ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                <TextField
                                  label="שם הצוות"
                                  value={editTeamName}
                                  onChange={(e) => setEditTeamName(e.target.value)}
                                  size="small"
                                  sx={{
                                    input: { color: themeColors.text, textAlign: 'right' },
                                    label: { color: themeColors.textSecondary, right: 28, left: 'auto' },
                                    fieldset: { borderColor: themeColors.backgroundSelected },
                                    '& .MuiOutlinedInput-root': {
                                      backgroundColor: themeColors.backgroundElement,
                                      '&:hover fieldset': { borderColor: themeColors.text },
                                      '&.Mui-focused fieldset': { borderColor: themeColors.text },
                                    }
                                  }}
                                />

                                <TextField
                                  label="משרד ראשי / מיקום"
                                  value={editTeamOffice}
                                  onChange={(e) => setEditTeamOffice(e.target.value)}
                                  size="small"
                                  sx={{
                                    input: { color: themeColors.text, textAlign: 'right' },
                                    label: { color: themeColors.textSecondary, right: 28, left: 'auto' },
                                    fieldset: { borderColor: themeColors.backgroundSelected },
                                    '& .MuiOutlinedInput-root': {
                                      backgroundColor: themeColors.backgroundElement,
                                      '&:hover fieldset': { borderColor: themeColors.text },
                                      '&.Mui-focused fieldset': { borderColor: themeColors.text },
                                    }
                                  }}
                                />

                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-start' }}>
                                  <Button
                                    variant="contained"
                                    onClick={() => handleSaveTeamEdit(team.id)}
                                    disabled={teamEditLoading}
                                    sx={{
                                      backgroundColor: themeColors.text,
                                      color: themeColors.background,
                                      fontWeight: 'bold',
                                      fontFamily: 'Rubik, sans-serif'
                                    }}
                                  >
                                    שמור שינויים
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    onClick={() => setEditTeamId(null)}
                                    sx={{
                                      borderColor: themeColors.backgroundSelected,
                                      color: themeColors.text,
                                      fontWeight: 'bold',
                                      fontFamily: 'Rubik, sans-serif'
                                    }}
                                  >
                                    ביטול
                                  </Button>
                                </Box>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                                  <Typography sx={{ fontWeight: 'bold', color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                                    {team.name}
                                  </Typography>
                                  {!!team.mainOffice && (
                                    <Typography variant="body2" sx={{ color: themeColors.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                                      🏢 משרד: {team.mainOffice}
                                    </Typography>
                                  )}
                                </Box>

                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    setEditTeamId(team.id);
                                    setEditTeamName(team.name);
                                    setEditTeamOffice(team.mainOffice || '');
                                    setTeamEditMessage(null);
                                  }}
                                  sx={{
                                    borderColor: themeColors.backgroundSelected,
                                    color: '#007aff',
                                    fontWeight: 'bold',
                                    fontFamily: 'Rubik, sans-serif'
                                  }}
                                >
                                  ערוך פרטים
                                </Button>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grow>
          </Grid>

        </Grid>
      </Container>
    </Box>
  );
}
