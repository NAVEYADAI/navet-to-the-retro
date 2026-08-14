import React, { useState, useEffect } from 'react';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Alert,
  CircularProgress,
  Fade,
} from '@mui/material';

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

export function TeamSprintsManagerWeb({ team, token, isAdmin, theme, onSelectSprint }: TeamSprintsManagerProps) {
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
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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

      {(showCreateForm && isAdmin) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2.5, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 2, mt: 1 }}>
          <Typography sx={{ fontWeight: 'bold', color: theme.text, fontSize: 13, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
            {Strings.sprints.createSprintHeader}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
              שם הספרינט
            </Typography>
            <TextField
              placeholder={Strings.sprints.sprintNamePlaceholder}
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              size="small"
              sx={{
                direction: 'rtl',
                input: { color: theme.text, textAlign: 'right', py: 1.2 },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.background,
                  borderRadius: '12px',
                  '& fieldset': { borderColor: theme.backgroundSelected },
                  '&:hover fieldset': { borderColor: theme.text },
                  '&.Mui-focused fieldset': { borderColor: theme.text, borderWidth: '1.5px' },
                },
                '& .MuiInputLabel-root': { display: 'none' },
                '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
              תיאור
            </Typography>
            <TextField
              placeholder={Strings.sprints.descriptionPlaceholder}
              value={description}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              size="small"
              sx={{
                direction: 'rtl',
                input: { color: theme.text, textAlign: 'right', py: 1.2 },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.background,
                  borderRadius: '12px',
                  '& fieldset': { borderColor: theme.backgroundSelected },
                  '&:hover fieldset': { borderColor: theme.text },
                  '&.Mui-focused fieldset': { borderColor: theme.text, borderWidth: '1.5px' },
                },
                '& .MuiInputLabel-root': { display: 'none' },
                '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, flex: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
                {Strings.sprints.startDateLabel}
              </Typography>
              <TextField
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                size="small"
                sx={{
                  direction: 'rtl',
                  input: { color: theme.text, textAlign: 'right', py: 1.2 },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.background,
                    borderRadius: '12px',
                    '& fieldset': { borderColor: theme.backgroundSelected },
                    '&:hover fieldset': { borderColor: theme.text },
                    '&.Mui-focused fieldset': { borderColor: theme.text, borderWidth: '1.5px' },
                  },
                  '& .MuiInputLabel-root': { display: 'none' },
                  '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, flex: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
                {Strings.sprints.endDateLabel}
              </Typography>
              <TextField
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                size="small"
                sx={{
                  direction: 'rtl',
                  input: { color: theme.text, textAlign: 'right', py: 1.2 },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.background,
                    borderRadius: '12px',
                    '& fieldset': { borderColor: theme.backgroundSelected },
                    '&:hover fieldset': { borderColor: theme.text },
                    '&.Mui-focused fieldset': { borderColor: theme.text, borderWidth: '1.5px' },
                  },
                  '& .MuiInputLabel-root': { display: 'none' },
                  '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
                }}
              />
            </Box>
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
      )}

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
                      borderColor: theme.backgroundSelected,
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
                      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
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

                      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.03)' }}>
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

              {isExpiredExpanded && (
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
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
