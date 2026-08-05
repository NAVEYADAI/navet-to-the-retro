import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Collapse,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';

// Platform safe shadow utility to avoid React Native Web deprecated shadow warnings
const getShadow = (opacity: number, radius: number, offsetHeight: number) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${offsetHeight}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: offsetHeight },
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
};

interface TeamSprintsManagerProps {
  team: any;
  token: string;
  isAdmin: boolean;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
  onSelectSprint: (sprint: any, team: any) => void;
}

export function TeamSprintsManager(props: TeamSprintsManagerProps) {
  if (Platform.OS === 'web') {
    return <TeamSprintsManagerWeb {...props} />;
  }
  return <TeamSprintsManagerNative {...props} />;
}

/* 1. WEB VERSION (Material UI + Pulses & Collapse, no external icons library needed) */
function TeamSprintsManagerWeb({ team, token, isAdmin, theme, onSelectSprint }: TeamSprintsManagerProps) {
  const [sprints, setSprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isExpiredExpanded, setIsExpiredExpanded] = useState(false);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const fetchSprints = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/${team.id}/sprints`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setSprints(response.data);
    } catch (err) {
      console.error('Failed to fetch sprints:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSprints();
  }, [team.id]);

  const handleCreateSprint = async () => {
    setError(null);
    if (!name.trim() || !startDate.trim() || !endDate.trim()) {
      setError('שם, תאריך התחלה ותאריך סיום הם שדות חובה.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/sprints`, {
        name,
        description: description || undefined,
        startDate,
        endDate
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setShowCreateForm(false);
      await fetchSprints();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בפתיחת ספרינט רטרו.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSprintStatus = (startDateStr: string, endDateStr: string) => {
    const now = new Date();
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (now >= start && now <= end) {
      return { label: 'פעיל', color: '#2e7d32', bg: 'rgba(46, 125, 50, 0.08)', isExpired: false };
    } else if (now < start) {
      return { label: 'עתידי', color: '#ff8f00', bg: 'rgba(255, 143, 0, 0.08)', isExpired: false };
    } else {
      return { label: 'סגור', color: '#757575', bg: 'rgba(117, 117, 117, 0.08)', isExpired: true };
    }
  };

  const activeSprints = sprints.filter(s => !getSprintStatus(s.startDate, s.endDate).isExpired);
  const expiredSprints = sprints.filter(s => getSprintStatus(s.startDate, s.endDate).isExpired);

  return (
    <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
          {Strings.sprints.header}
        </Typography>
        {isAdmin && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowCreateForm(!showCreateForm)}
            sx={{
              borderColor: theme.backgroundSelected,
              color: '#007aff',
              fontWeight: 'bold',
              fontFamily: 'Rubik, sans-serif',
              textTransform: 'none',
              fontSize: 12,
              '&:hover': {
                borderColor: theme.text,
                backgroundColor: 'rgba(0,0,0,0.01)',
              }
            }}
          >
            {showCreateForm ? Strings.sprints.cancelButton : Strings.sprints.newSprintButton}
          </Button>
        )}
      </Box>

      <Collapse in={showCreateForm && isAdmin} timeout="auto" unmountOnExit>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2.5, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 2, mt: 1 }}>
          <Typography sx={{ fontWeight: 'bold', color: theme.text, fontSize: 13, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
            {Strings.sprints.createSprintHeader}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
              {error}
            </Alert>
          )}

          <TextField
            label="שם הספרינט"
            placeholder={Strings.sprints.sprintNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              input: { color: theme.text, textAlign: 'right' },
              label: { color: theme.textSecondary, right: 28, left: 'auto' },
              fieldset: { borderColor: theme.backgroundSelected },
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.background,
                '&:hover fieldset': { borderColor: theme.text },
                '&.Mui-focused fieldset': { borderColor: theme.text },
              }
            }}
          />

          <TextField
            label="תיאור"
            placeholder={Strings.sprints.descriptionPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              input: { color: theme.text, textAlign: 'right' },
              label: { color: theme.textSecondary, right: 28, left: 'auto' },
              fieldset: { borderColor: theme.backgroundSelected },
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.background,
                '&:hover fieldset': { borderColor: theme.text },
                '&.Mui-focused fieldset': { borderColor: theme.text },
              }
            }}
          />

          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', gap: 2 }}>
            <TextField
              type="date"
              label={Strings.sprints.startDateLabel}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
              sx={{
                flex: 1,
                input: { color: theme.text, textAlign: 'right' },
                label: { color: theme.textSecondary, right: 28, left: 'auto' },
                fieldset: { borderColor: theme.backgroundSelected },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.background,
                  '&:hover fieldset': { borderColor: theme.text },
                  '&.Mui-focused fieldset': { borderColor: theme.text },
                }
              }}
            />

            <TextField
              type="date"
              label={Strings.sprints.endDateLabel}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
              sx={{
                flex: 1,
                input: { color: theme.text, textAlign: 'right' },
                label: { color: theme.textSecondary, right: 28, left: 'auto' },
                fieldset: { borderColor: theme.backgroundSelected },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.background,
                  '&:hover fieldset': { borderColor: theme.text },
                  '&.Mui-focused fieldset': { borderColor: theme.text },
                }
              }}
            />
          </Box>

          <Button
            variant="contained"
            onClick={handleCreateSprint}
            disabled={isSubmitting}
            sx={{
              backgroundColor: theme.text,
              color: theme.background,
              fontWeight: 'bold',
              fontFamily: 'Rubik, sans-serif',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: theme.textSecondary,
              }
            }}
          >
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'פתח ספרינט רטרו'}
          </Button>
        </Box>
      </Collapse>

      {isLoading ? (
        <CircularProgress size={24} color="inherit" sx={{ alignSelf: 'center', my: 2, color: theme.text }} />
      ) : sprints.length === 0 ? (
        <Typography variant="body2" sx={{ fontStyle: 'italic', textAlign: 'center', color: theme.textSecondary, my: 1, fontFamily: 'Rubik, sans-serif' }}>
          {isAdmin ? Strings.sprints.noSprintsTextAdmin : Strings.sprints.noSprintsTextMember}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeSprints.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {activeSprints.map((sprint) => {
                const status = getSprintStatus(sprint.startDate, sprint.endDate);
                const isActive = status.label === 'פעיל';

                return (
                  <Card
                    key={sprint.id}
                    onClick={() => onSelectSprint(sprint, team)}
                    sx={{
                      backgroundColor: theme.background,
                      borderColor: isActive ? '#2e7d32' : theme.backgroundSelected,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderRadius: 3,
                      borderRightWidth: 5,
                      borderRightColor: status.color,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0px 6px 16px rgba(0,0,0,0.06)',
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 1 }}>
                          {isActive && (
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: '#2e7d32',
                                animation: 'pulse 1.5s infinite ease-in-out',
                                '@keyframes pulse': {
                                  '0%': { transform: 'scale(0.85)', boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.7)' },
                                  '70%': { transform: 'scale(1)', boxShadow: '0 0 0 8px rgba(46, 125, 50, 0)' },
                                  '100%': { transform: 'scale(0.85)', boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)' },
                                }
                              }}
                            />
                          )}
                          <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
                            {sprint.name}
                          </Typography>
                        </Box>

                        <Box sx={{ px: 1, py: 0.25, borderRadius: 1, backgroundColor: status.bg }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 'bold', color: status.color, fontFamily: 'Rubik, sans-serif' }}>
                            {isActive ? 'בלייב 🟢' : status.label}
                          </Typography>
                        </Box>
                      </Box>

                      {sprint.description && (
                        <Typography variant="body2" sx={{ color: theme.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
                          {sprint.description}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                        <Typography sx={{ fontSize: 11, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                          📅 {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: '#007aff', fontWeight: 'bold', fontFamily: 'Rubik, sans-serif' }}>
                          {Strings.sprints.enterRetroButton}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          {expiredSprints.length > 0 && (
            <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
              <Box
                onClick={() => setIsExpiredExpanded(!isExpiredExpanded)}
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1.5,
                  backgroundColor: theme.backgroundSelected,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <Typography sx={{ fontSize: 12, fontFamily: 'Rubik, sans-serif' }}>
                  {isExpiredExpanded ? '▲' : '▼'}
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
                  ספרינטים קודמים שנסגרו ({expiredSprints.length})
                </Typography>
              </Box>

              <Collapse in={isExpiredExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, backgroundColor: 'rgba(0,0,0,0.01)' }}>
                  {expiredSprints.map((sprint) => {
                    const status = getSprintStatus(sprint.startDate, sprint.endDate);
                    return (
                      <Card
                        key={sprint.id}
                        onClick={() => onSelectSprint(sprint, team)}
                        sx={{
                          backgroundColor: theme.background,
                          borderColor: theme.backgroundSelected,
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderRadius: 2,
                          borderRightWidth: 4,
                          borderRightColor: status.color,
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease',
                          '&:hover': {
                            transform: 'translateY(-1px)',
                          }
                        }}
                      >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
                            {sprint.name}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                            {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                          </Typography>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/* 2. NATIVE VERSION (React Native - fully RTL & Jest compatible) */
function TeamSprintsManagerNative({ team, token, isAdmin, theme, onSelectSprint }: TeamSprintsManagerProps) {
  const [sprints, setSprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isExpiredExpanded, setIsExpiredExpanded] = useState(false);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const fetchSprints = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/${team.id}/sprints`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setSprints(response.data);
    } catch (err) {
      console.error('Failed to fetch sprints:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSprints();
  }, [team.id]);

  const handleCreateSprint = async () => {
    setError(null);
    if (!name.trim() || !startDate.trim() || !endDate.trim()) {
      setError('שם, תאריך התחלה ותאריך סיום הם שדות חובה.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/sprints`, {
        name,
        description: description || undefined,
        startDate,
        endDate
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setShowCreateForm(false);
      await fetchSprints();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בפתיחת ספרינט רטרו.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSprintStatus = (startDateStr: string, endDateStr: string) => {
    const now = new Date();
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (now >= start && now <= end) {
      return { label: 'פעיל', color: '#2e7d32', bg: 'rgba(46, 125, 50, 0.08)', isExpired: false };
    } else if (now < start) {
      return { label: 'עתידי', color: '#ff8f00', bg: 'rgba(255, 143, 0, 0.08)', isExpired: false };
    } else {
      return { label: 'סגור', color: '#757575', bg: 'rgba(117, 117, 117, 0.08)', isExpired: true };
    }
  };

  const activeSprints = sprints.filter(s => !getSprintStatus(s.startDate, s.endDate).isExpired);
  const expiredSprints = sprints.filter(s => getSprintStatus(s.startDate, s.endDate).isExpired);

  return (
    <View style={nativeStyles.container}>
      <View style={nativeStyles.headerRow}>
        {isAdmin && (
          <TouchableOpacity
            style={[nativeStyles.toggleFormButton, { borderColor: theme.backgroundSelected }]}
            onPress={() => setShowCreateForm(!showCreateForm)}
          >
            <ThemedText style={{ fontSize: 12, color: '#007aff', fontWeight: 'bold' }}>
              {showCreateForm ? Strings.sprints.cancelButton : Strings.sprints.newSprintButton}
            </ThemedText>
          </TouchableOpacity>
        )}
        <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 15, textAlign: 'right' }}>
          {Strings.sprints.header}
        </ThemedText>
      </View>

      {showCreateForm && isAdmin && (
        <View style={[nativeStyles.createForm, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 13, textAlign: 'right' }}>
            {Strings.sprints.createSprintHeader}
          </ThemedText>

          {!!error && (
            <View style={nativeStyles.errorBanner}>
              <ThemedText style={nativeStyles.errorText}>{error}</ThemedText>
            </View>
          )}

          <TextInput
            style={[
              nativeStyles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.background,
              },
            ]}
            placeholder={Strings.sprints.sprintNamePlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
            textAlign="right"
          />

          <TextInput
            style={[
              nativeStyles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.background,
              },
            ]}
            placeholder={Strings.sprints.descriptionPlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            textAlign="right"
          />

          <View style={nativeStyles.datesRow}>
            <TextInput
              style={[
                nativeStyles.input,
                nativeStyles.halfInput,
                {
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder="תאריך התחלה"
              placeholderTextColor={theme.textSecondary}
              value={startDate}
              onChangeText={setStartDate}
              textAlign="right"
            />

            <TextInput
              style={[
                nativeStyles.input,
                nativeStyles.halfInput,
                {
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder="תאריך סיום"
              placeholderTextColor={theme.textSecondary}
              value={endDate}
              onChangeText={setEndDate}
              textAlign="right"
            />
          </View>

          <TouchableOpacity
            style={[nativeStyles.submitButton, { backgroundColor: theme.text }]}
            onPress={handleCreateSprint}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.background} size="small" />
            ) : (
              <ThemedText style={{ fontWeight: 'bold', color: theme.background, fontSize: 13 }}>
                {Strings.sprints.openRetroButton}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="small" color={theme.text} style={{ marginVertical: Spacing.two }} />
      ) : sprints.length === 0 ? (
        <ThemedText type="default" style={nativeStyles.noSprintsText}>
          {isAdmin ? Strings.sprints.noSprintsTextAdmin : Strings.sprints.noSprintsTextMember}
        </ThemedText>
      ) : (
        <View style={nativeStyles.sprintsList}>
          {activeSprints.map((sprint) => {
            const status = getSprintStatus(sprint.startDate, sprint.endDate);
            const isActive = status.label === 'פעיל';

            return (
              <TouchableOpacity
                key={sprint.id}
                style={[
                  nativeStyles.sprintCard,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundSelected,
                    borderRightWidth: 4,
                    borderRightColor: status.color,
                  }
                ]}
                onPress={() => onSelectSprint(sprint, team)}
              >
                <View style={nativeStyles.sprintInfo}>
                  <View style={nativeStyles.sprintTitleRow}>
                    <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14 }}>
                      {sprint.name}
                    </ThemedText>
                    <View style={[nativeStyles.statusBadge, { backgroundColor: status.bg }]}>
                      <ThemedText style={{ fontSize: 10, fontWeight: 'bold', color: status.color }}>
                        {isActive ? 'בלייב 🟢' : status.label}
                      </ThemedText>
                    </View>
                  </View>
                  {!!sprint.description && (
                    <ThemedText type="default" style={{ fontSize: 12, opacity: 0.8, marginTop: 2, textAlign: 'right' }}>
                      {sprint.description}
                    </ThemedText>
                  )}
                  <ThemedText type="code" style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                    {`${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
                  </ThemedText>
                </View>
                <View style={[nativeStyles.enterBadge, { backgroundColor: theme.backgroundSelected, marginRight: Spacing.two }]}>
                  <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: theme.text }}>
                    {Strings.sprints.enterRetroButton}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            );
          })}

          {expiredSprints.length > 0 && (
            <View style={nativeStyles.expiredAccordion}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[nativeStyles.accordionHeader, { backgroundColor: theme.backgroundSelected }]}
                onPress={() => setIsExpiredExpanded(!isExpiredExpanded)}
              >
                <ThemedText style={{ fontSize: 11, color: theme.text }}>
                  {isExpiredExpanded ? '▲' : '▼'}
                </ThemedText>
                <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>
                  ספרינטים קודמים שנסגרו ({expiredSprints.length})
                </ThemedText>
              </TouchableOpacity>

              {isExpiredExpanded && (
                <View style={[nativeStyles.accordionContent, { backgroundColor: theme.background }]}>
                  {expiredSprints.map((sprint) => {
                    const status = getSprintStatus(sprint.startDate, sprint.endDate);
                    return (
                      <TouchableOpacity
                        key={sprint.id}
                        style={[
                          nativeStyles.sprintCard,
                          {
                            backgroundColor: theme.background,
                            borderColor: theme.backgroundSelected,
                            borderRightWidth: 4,
                            borderRightColor: status.color,
                            marginVertical: 4,
                          }
                        ]}
                        onPress={() => onSelectSprint(sprint, team)}
                      >
                        <View style={nativeStyles.sprintInfo}>
                          <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 13, textAlign: 'right' }}>
                            {sprint.name}
                          </ThemedText>
                          <ThemedText type="code" style={{ fontSize: 11, opacity: 0.7, marginTop: 2, textAlign: 'right' }}>
                            {`${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
                          </ThemedText>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const nativeStyles = StyleSheet.create({
  container: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleFormButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  createForm: {
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    fontSize: 13,
  },
  datesRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.two,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  noSprintsText: {
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'center',
    marginVertical: Spacing.one,
    fontStyle: 'italic',
  },
  sprintsList: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  sprintCard: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  sprintInfo: {
    gap: 2,
    flex: 1,
  },
  sprintTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  enterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.one,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 12,
    textAlign: 'center',
  },
  expiredAccordion: {
    marginTop: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.two,
  },
  accordionContent: {
    padding: Spacing.two,
  },
});
