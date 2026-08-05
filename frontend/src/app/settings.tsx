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

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: themeColors.background, pt: { xs: 14, md: 12 }, pb: 6, direction: 'rtl' }}>
      <Container maxWidth="md" sx={{ mx: 'auto' }}>
        {/* Header section (RTL) */}
        <Fade in={true} timeout={500}>
          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 'bold', color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}
            >
              הגדרות מערכת
            </Typography>
            <Button
              variant="outlined"
              onClick={() => router.push('/')}
              sx={{
                borderColor: themeColors.backgroundSelected,
                color: themeColors.text,
                fontWeight: 'bold',
                fontFamily: 'Rubik, sans-serif',
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': {
                  borderColor: themeColors.text,
                  backgroundColor: 'rgba(0,0,0,0.02)',
                }
              }}
            >
              חזרה לראשי
            </Button>
          </Box>
        </Fade>

        {/* Content grid */}
        <Grid container spacing={4} direction={{ xs: 'column', md: 'row-reverse' }}>
          
          {/* Left Column: Personal details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Grow in={true} timeout={400}>
              <Card
                sx={{
                  backgroundColor: themeColors.backgroundElement,
                  borderColor: themeColors.backgroundSelected,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderRadius: 4,
                  boxShadow: '0px 4px 12px rgba(0,0,0,0.04)',
                }}
              >
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                    עדכון פרטים אישיים
                  </Typography>

                  {profileMessage && (
                    <Fade in={true}>
                      <Alert
                        severity={profileMessage.isError ? 'error' : 'success'}
                        sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}
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
                      sx={{
                        input: { color: themeColors.text, textAlign: 'right' },
                        label: { color: themeColors.textSecondary, right: 28, left: 'auto' },
                        fieldset: { borderColor: themeColors.backgroundSelected },
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: themeColors.background,
                          '&:hover fieldset': { borderColor: themeColors.text },
                          '&.Mui-focused fieldset': { borderColor: themeColors.text },
                        }
                      }}
                    />

                    <TextField
                      label="שם משפחה"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{
                        input: { color: themeColors.text, textAlign: 'right' },
                        label: { color: themeColors.textSecondary, right: 28, left: 'auto' },
                        fieldset: { borderColor: themeColors.backgroundSelected },
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: themeColors.background,
                          '&:hover fieldset': { borderColor: themeColors.text },
                          '&.Mui-focused fieldset': { borderColor: themeColors.text },
                        }
                      }}
                    />

                    <TextField
                      label="כתובת אימייל"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{
                        input: { color: themeColors.text, textAlign: 'right' },
                        label: { color: themeColors.textSecondary, right: 28, left: 'auto' },
                        fieldset: { borderColor: themeColors.backgroundSelected },
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: themeColors.background,
                          '&:hover fieldset': { borderColor: themeColors.text },
                          '&.Mui-focused fieldset': { borderColor: themeColors.text },
                        }
                      }}
                    />
                  </Box>

                  <Button
                    variant="contained"
                    onClick={handleUpdateProfile}
                    disabled={profileLoading}
                    sx={{
                      backgroundColor: themeColors.text,
                      color: themeColors.background,
                      fontWeight: 'bold',
                      fontFamily: 'Rubik, sans-serif',
                      textTransform: 'none',
                      borderRadius: 2,
                      py: 1,
                      '&:hover': {
                        backgroundColor: themeColors.textSecondary,
                      }
                    }}
                  >
                    {profileLoading ? (
                      <CircularProgress size={24} color="inherit" />
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
              <Card
                sx={{
                  backgroundColor: themeColors.backgroundElement,
                  borderColor: themeColors.backgroundSelected,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderRadius: 4,
                  boxShadow: '0px 4px 12px rgba(0,0,0,0.04)',
                }}
              >
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                    יצירת צוות חדש
                  </Typography>

                  {teamMessage && (
                    <Fade in={true}>
                      <Alert
                        severity={teamMessage.isError ? 'error' : 'success'}
                        sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}
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
                sx={{
                  backgroundColor: themeColors.backgroundElement,
                  borderColor: themeColors.backgroundSelected,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderRadius: 4,
                  boxShadow: '0px 4px 12px rgba(0,0,0,0.04)',
                  mt: 2
                }}
              >
                <CardContent sx={{ p: 4, textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                    ניהול ועריכת צוותים בניהולך
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
