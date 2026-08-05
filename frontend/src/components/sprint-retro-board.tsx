import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Switch, Platform, useColorScheme as useRNColorScheme, useWindowDimensions, Animated } from 'react-native';
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
  TextField,
  Switch as MuiSwitch,
  CircularProgress,
  Alert,
  Grid,
  FormControlLabel,
  Grow,
  Fade,
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

interface SprintRetroBoardProps {
  sprint: any;
  team: any;
  token: string;
  user: any;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
  onBack: () => void;
}

export function SprintRetroBoard(props: SprintRetroBoardProps) {
  if (Platform.OS === 'web') {
    return <SprintRetroBoardWeb {...props} />;
  }
  return <SprintRetroBoardNative {...props} />;
}

/* 1. WEB VERSION (Material UI + Smooth CSS transitions & Grow entry animations) */
function SprintRetroBoardWeb({ sprint, team, token, user, theme, onBack }: SprintRetroBoardProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New comment state
  const [content, setContent] = useState('');
  const [type, setType] = useState<'KEEP' | 'IMPROVE'>('KEEP');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBackendUrl = () => {
    return typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [sprint.id]);

  const handlePostComment = async () => {
    setError(null);
    if (!content.trim()) {
      setError('תוכן ההערה אינו יכול להיות ריק.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        content: content.trim(),
        type,
        isAnonymous
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setContent('');
      setIsAnonymous(false);
      await fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בשליחת ההערה.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleType = () => {
    setType(prev => prev === 'KEEP' ? 'IMPROVE' : 'KEEP');
  };

  const myMembership = team.members?.find((m: any) => m.userId === user.id);
  const isAdmin = myMembership?.isAdmin || false;

  const keepComments = comments.filter(c => c.type === 'KEEP');
  const improveComments = comments.filter(c => c.type === 'IMPROVE');

  // Sticky-notes themes
  const keepBg = '#e8f5e9';
  const keepText = '#1b5e20';
  const keepMetaText = '#2e7d32';

  const improveBg = '#ffebee';
  const improveText = '#b71c1c';
  const improveMetaText = '#c62828';

  const isDark = useRNColorScheme() === 'dark';
  const accent = isDark ? '#818cf8' : '#6366f1';
  const boardCardSx = {
    backgroundColor: isDark ? 'rgba(15,15,24,0.6)' : 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(12px)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    borderRadius: '20px',
    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.04)',
    mb: 2,
  };

  return (
    <Box sx={{
      px: { xs: 2, md: 4 },
      pt: { xs: 14, md: 12 },
      pb: { xs: 4, md: 6 },
      minHeight: '100vh',
      direction: 'rtl',
    }}>
      <Box sx={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {/* Header */}
        <Fade in={true} timeout={500}>
          <Box sx={{ pb: 3, mb: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={onBack}
              sx={{
                alignSelf: 'flex-end',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                color: theme.text,
                fontWeight: 700,
                fontFamily: 'Rubik, sans-serif',
                borderRadius: '12px',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: accent,
                  color: accent,
                  backgroundColor: `${accent}08`,
                }
              }}
            >
              {Strings.retroBoard.backButton}
            </Button>
            
            <Box sx={{ textAlign: 'right', animation: 'fadeInUp 0.5s ease both' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: theme.text, fontFamily: 'Rubik, sans-serif', mb: 0.5, letterSpacing: -0.5 }}>
                {sprint.name} 📋
              </Typography>
              <Typography variant="body2" sx={{ color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                {`${team.name} • ${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
              </Typography>
              {sprint.description && (
                <Typography variant="body1" sx={{ color: theme.text, fontStyle: 'italic', mt: 1.5, fontFamily: 'Rubik, sans-serif', opacity: 0.8 }}>
                  {sprint.description}
                </Typography>
              )}
            </Box>
          </Box>
        </Fade>

        {/* Input Form */}
        <Grow in={true} timeout={500}>
          <Card sx={boardCardSx}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
                ✍️ {Strings.retroBoard.writeNoteHeader}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right', borderRadius: '12px', fontFamily: 'Rubik, sans-serif' }}>
                  {error}
                </Alert>
              )}

              {/* Yin-Yang / Hourglass Sand Toy Toggle Wheel */}
              <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, my: 1 }}>
                <Box
                  onClick={toggleType}
                  sx={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `4px solid ${isDark ? '#818cf8' : '#ffffff'}`,
                    position: 'relative',
                    cursor: 'pointer',
                    boxShadow: isDark
                      ? '0 8px 24px rgba(0,0,0,0.5), 0 0 20px rgba(99,102,241,0.4)'
                      : '0 8px 24px rgba(0,0,0,0.15), 0 0 16px rgba(99,102,241,0.25)',
                    transition: 'transform 0.75s cubic-bezier(0.68, -0.6, 0.32, 1.6), box-shadow 0.3s ease',
                    transform: type === 'KEEP' ? 'rotate(0deg)' : 'rotate(180deg)',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      transform: type === 'KEEP' ? 'scale(1.12) rotate(0deg)' : 'scale(1.12) rotate(180deg)',
                      boxShadow: isDark
                        ? '0 12px 32px rgba(0,0,0,0.6), 0 0 25px rgba(99,102,241,0.6)'
                        : '0 12px 32px rgba(0,0,0,0.2), 0 0 20px rgba(99,102,241,0.4)',
                    },
                    '&:active': {
                      transform: type === 'KEEP' ? 'scale(0.9) rotate(-15deg)' : 'scale(0.9) rotate(195deg)',
                    },
                  }}
                >
                  {/* Top Half: KEEP (Emerald Vivid Green) */}
                  <Box sx={{
                    height: '50%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <Box sx={{
                      transform: type === 'KEEP' ? 'none' : 'rotate(-180deg)',
                      transition: 'transform 0.75s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
                    }}>
                      <Typography sx={{ fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}>👍</Typography>
                    </Box>
                  </Box>

                  {/* Bottom Half: IMPROVE (Rose Vivid Crimson) */}
                  <Box sx={{
                    height: '50%',
                    background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <Box sx={{
                      transform: type === 'KEEP' ? 'none' : 'rotate(-180deg)',
                      transition: 'transform 0.75s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
                    }}>
                      <Typography sx={{ fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}>🔧</Typography>
                    </Box>
                  </Box>

                  {/* Center Orifice with Glass/Hourglass Stream Bead */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 0 10px rgba(255,255,255,0.9), inset 0 2px 4px rgba(0,0,0,0.25)',
                      zIndex: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#f59e0b',
                        boxShadow: '0 0 8px #f59e0b',
                        animation: 'sandStream 1.2s ease-in-out infinite',
                      }}
                    />
                  </Box>

                  {/* Trickling Sand Particles (children's toy sand effect) */}
                  {[
                    { left: '42%', delay: '0s', duration: '1s' },
                    { left: '50%', delay: '0.35s', duration: '0.9s' },
                    { left: '58%', delay: '0.7s', duration: '1.2s' },
                  ].map((p, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        position: 'absolute',
                        top: '30%',
                        left: p.left,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        backgroundColor: '#fde047',
                        boxShadow: '0 0 4px #eab308',
                        zIndex: 4,
                        animation: `sandFall ${p.duration} linear infinite`,
                        animationDelay: p.delay,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif', mb: 0.5, fontWeight: 500 }}>
                    {Strings.retroBoard.spinLabel} ⏳
                  </Typography>
                  <Typography sx={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: type === 'KEEP' ? '#10b981' : '#f43f5e',
                    fontFamily: 'Rubik, sans-serif',
                    letterSpacing: -0.3,
                    transition: 'color 0.3s ease',
                  }}>
                    {type === 'KEEP' ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}
                  </Typography>
                </Box>
              </Box>

              <TextField
                multiline
                rows={3}
                placeholder={type === 'KEEP' ? "מה עבד טוב? ציין הישגים..." : "מה אפשר לשפר? הצע שיפורים..."}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                sx={{
                  textarea: { color: theme.text, textAlign: 'right', fontFamily: 'Rubik, sans-serif' },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: accent },
                    '&.Mui-focused fieldset': { borderColor: accent, borderWidth: 2 },
                    fieldset: { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                  }
                }}
              />

              <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <MuiSwitch
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                      }}
                    />
                  }
                  label={Strings.retroBoard.anonymousLabel}
                  labelPlacement="start"
                  sx={{ m: 0, gap: 1, '& .MuiFormControlLabel-label': { color: theme.text, fontSize: 13, fontFamily: 'Rubik, sans-serif' } }}
                />

                <Button
                  variant="contained"
                  onClick={handlePostComment}
                  disabled={isSubmitting}
                  sx={{
                    background: `linear-gradient(135deg, ${accent} 0%, #8b5cf6 100%)`,
                    color: '#fff',
                    fontWeight: 700,
                    fontFamily: 'Rubik, sans-serif',
                    textTransform: 'none',
                    borderRadius: '12px',
                    px: 3,
                    boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
                    },
                  }}
                >
                  {isSubmitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : Strings.retroBoard.postNoteButton}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grow>

        {/* Board Columns */}
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
            <CircularProgress color="inherit" sx={{ color: theme.text }} />
            <Typography sx={{ color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
              {Strings.retroBoard.loadingBoard}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={4} direction={{ xs: 'column', md: 'row-reverse' }}>
            
            {/* Column 1: KEEP */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid #2e7d32', backgroundColor: 'rgba(46, 125, 50, 0.06)', textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2e7d32', fontFamily: 'Rubik, sans-serif' }}>
                    {Strings.retroBoard.keepColumnHeader}
                  </Typography>
                </Box>

                {keepComments.length === 0 ? (
                  <Typography variant="body2" sx={{ textAlign: 'center', color: theme.textSecondary, fontStyle: 'italic', my: 2, fontFamily: 'Rubik, sans-serif' }}>
                    {Strings.retroBoard.emptyKeepText}
                  </Typography>
                ) : (
                  keepComments.map((comment, index) => (
                    <Grow in={true} key={comment.id} timeout={(index % 8) * 100 + 300}>
                      <Card sx={{ backgroundColor: keepBg, borderRight: '5px solid #2e7d32', borderRadius: 2.5, boxShadow: '0px 3px 6px rgba(0,0,0,0.03)' }}>
                        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.5, textAlign: 'right' }}>
                          <Typography sx={{ color: keepText, fontWeight: '500', lineHeight: 1.5, fontFamily: 'Rubik, sans-serif', fontSize: 14 }}>
                            {comment.content}
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', pt: 1, borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                            {comment.isAnonymous ? (
                              <Typography sx={{ fontSize: 11, fontWeight: 'bold', fontStyle: 'italic', color: '#ff8f00', fontFamily: 'Rubik, sans-serif' }}>
                                {comment.author.username !== 'Anonymous' && isAdmin
                                  ? Strings.retroBoard.anonymousByAdmin(comment.author.username)
                                  : Strings.retroBoard.anonymousAuthor}
                              </Typography>
                            ) : (
                              <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: keepMetaText, fontFamily: 'Rubik, sans-serif' }}>
                                @{comment.author.username}
                              </Typography>
                            )}
                            <Typography sx={{ fontSize: 11, color: keepMetaText, opacity: 0.7, fontFamily: 'Rubik, sans-serif' }}>
                              {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grow>
                  ))
                )}
              </Box>
            </Grid>

            {/* Column 2: IMPROVE */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid #c62828', backgroundColor: 'rgba(198, 40, 40, 0.06)', textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#c62828', fontFamily: 'Rubik, sans-serif' }}>
                    {Strings.retroBoard.improveColumnHeader}
                  </Typography>
                </Box>

                {improveComments.length === 0 ? (
                  <Typography variant="body2" sx={{ textAlign: 'center', color: theme.textSecondary, fontStyle: 'italic', my: 2, fontFamily: 'Rubik, sans-serif' }}>
                    {Strings.retroBoard.emptyImproveText}
                  </Typography>
                ) : (
                  improveComments.map((comment, index) => (
                    <Grow in={true} key={comment.id} timeout={(index % 8) * 100 + 350}>
                      <Card sx={{ backgroundColor: improveBg, borderRight: '5px solid #c62828', borderRadius: 2.5, boxShadow: '0px 3px 6px rgba(0,0,0,0.03)' }}>
                        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.5, textAlign: 'right' }}>
                          <Typography sx={{ color: improveText, fontWeight: '500', lineHeight: 1.5, fontFamily: 'Rubik, sans-serif', fontSize: 14 }}>
                            {comment.content}
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', pt: 1, borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                            {comment.isAnonymous ? (
                              <Typography sx={{ fontSize: 11, fontWeight: 'bold', fontStyle: 'italic', color: '#ff8f00', fontFamily: 'Rubik, sans-serif' }}>
                                {comment.author.username !== 'Anonymous' && isAdmin
                                  ? Strings.retroBoard.anonymousByAdmin(comment.author.username)
                                  : Strings.retroBoard.anonymousAuthor}
                              </Typography>
                            ) : (
                              <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: improveMetaText, fontFamily: 'Rubik, sans-serif' }}>
                                @{comment.author.username}
                              </Typography>
                            )}
                            <Typography sx={{ fontSize: 11, color: improveMetaText, opacity: 0.7, fontFamily: 'Rubik, sans-serif' }}>
                              {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grow>
                  ))
                )}
              </Box>
            </Grid>

          </Grid>
        )}

      </Box>
    </Box>
  );
}

/* 2. NATIVE VERSION (React Native - fully RTL & Jest compatible) */
function SprintRetroBoardNative({ sprint, team, token, user, theme, onBack }: SprintRetroBoardProps) {
  const colorScheme = useRNColorScheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New comment state
  const [content, setContent] = useState('');
  const [type, setType] = useState<'KEEP' | 'IMPROVE'>('KEEP');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animated spin value for the Yin-Yang wheel
  const [spinAnim] = useState(new Animated.Value(type === 'KEEP' ? 0 : 1));

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [sprint.id]);

  const handlePostComment = async () => {
    setError(null);
    if (!content.trim()) {
      setError('תוכן ההערה אינו יכול להיות ריק.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        content: content.trim(),
        type,
        isAnonymous
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setContent('');
      setIsAnonymous(false);
      await fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בשליחת ההערה.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleType = () => {
    const nextType = type === 'KEEP' ? 'IMPROVE' : 'KEEP';
    Animated.spring(spinAnim, {
      toValue: nextType === 'KEEP' ? 0 : 1,
      tension: 30,
      friction: 6,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    setType(nextType);
  };

  const myMembership = team.members?.find((m: any) => m.userId === user.id);
  const isAdmin = myMembership?.isAdmin || false;

  const keepComments = comments.filter(c => c.type === 'KEEP');
  const improveComments = comments.filter(c => c.type === 'IMPROVE');

  // Sticky-notes themes
  const keepBg = colorScheme === 'dark' ? '#1b5e20' : '#e8f5e9';
  const keepText = colorScheme === 'dark' ? '#e8f5e9' : '#1b5e20';
  const keepMetaText = colorScheme === 'dark' ? '#a5d6a7' : '#2e7d32';

  const improveBg = colorScheme === 'dark' ? '#b71c1c' : '#ffebee';
  const improveText = colorScheme === 'dark' ? '#ffebee' : '#b71c1c';
  const improveMetaText = colorScheme === 'dark' ? '#ef9a9a' : '#c62828';

  // Rotation interpolations
  const wheelRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const contentRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-180deg'],
  });

  return (
    <ScrollView 
      style={[styles.scrollContainer, { backgroundColor: theme.background }]} 
      contentContainerStyle={{ paddingTop: isDesktop ? 80 : 100, paddingBottom: Spacing.four }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        {/* Header (RTL flow) */}
        <View style={[styles.header, { borderBottomColor: theme.backgroundSelected }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.backgroundSelected }]} onPress={onBack}>
            <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: theme.text }}>
              {Strings.retroBoard.backButton}
            </ThemedText>
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {sprint.name} {Strings.retroBoard.keepLabel.split(' ')[1]}
            </ThemedText>
            <ThemedText type="default" style={styles.subtitle}>
              {`${team.name} • ${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
            </ThemedText>
            {sprint.description && (
              <ThemedText type="default" style={styles.description}>
                {sprint.description}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Main Form for Posting (RTL formatted) */}
        <View style={[styles.postSection, { backgroundColor: theme.backgroundElement }, getShadow(0.04, 5, 3)]}>
          <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14, marginBottom: Spacing.one, textAlign: 'right' }}>
            {Strings.retroBoard.writeNoteHeader}
          </ThemedText>

          {!!error && (
            <View style={styles.errorBanner}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {/* Yin-Yang Style Animated Toggle Wheel */}
          <View style={styles.wheelWrapper}>
            <TouchableOpacity activeOpacity={0.9} onPress={toggleType}>
              <Animated.View style={[styles.yinYangWheel, { transform: [{ rotate: wheelRotation }] }]}>
                <View style={[styles.wheelHalf, styles.keepHalf, { backgroundColor: keepBg }]}>
                  <Animated.View style={{ transform: [{ rotate: contentRotation }] }}>
                    <ThemedText style={{ fontSize: 24 }}>👍</ThemedText>
                  </Animated.View>
                </View>
                <View style={[styles.wheelHalf, styles.improveHalf, { backgroundColor: improveBg }]}>
                  <Animated.View style={{ transform: [{ rotate: contentRotation }] }}>
                    <ThemedText style={{ fontSize: 24 }}>🔧</ThemedText>
                  </Animated.View>
                </View>
                <View style={[styles.wheelCenter, { backgroundColor: theme.backgroundElement }]} />
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.wheelLabelContainer}>
              <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 2, textAlign: 'right' }}>
                {Strings.retroBoard.spinLabel}
              </ThemedText>
              <ThemedText style={{
                fontSize: 14,
                fontWeight: 'bold',
                color: type === 'KEEP' ? '#2e7d32' : '#c62828',
                textAlign: 'right'
              }}>
                {type === 'KEEP' ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}
              </ThemedText>
            </View>
          </View>

          <TextInput
            style={[
              styles.textarea,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.background,
              },
            ]}
            placeholder={type === 'KEEP' ? "מה עבד טוב? ציין הישגים..." : "מה אפשר לשפר? הצע שיפורים..."}
            placeholderTextColor={theme.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={3}
          />

          <View style={styles.formControls}>
            <View style={styles.anonControl}>
              <ThemedText type="default" style={{ fontSize: 12, opacity: 0.8 }}>
                {Strings.retroBoard.anonymousLabel}
              </ThemedText>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: theme.backgroundSelected, true: theme.text }}
                thumbColor={isAnonymous ? theme.background : theme.backgroundSelected}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: theme.text }]}
              onPress={handlePostComment}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <ThemedText style={{ fontWeight: 'bold', color: theme.background, fontSize: 13 }}>
                  {Strings.retroBoard.postNoteButton}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Board Columns (RTL Flow) */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText type="default">{Strings.retroBoard.loadingBoard}</ThemedText>
          </View>
        ) : (
          <View style={[styles.columnsContainer, { flexDirection: isDesktop ? 'row-reverse' : 'column' }]}>
            {/* Column 1: KEEP */}
            <View style={styles.column}>
              <View style={[styles.columnHeader, { backgroundColor: 'rgba(46, 125, 50, 0.08)', borderColor: '#2e7d32' }]}>
                <ThemedText type="default" style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                  {Strings.retroBoard.keepColumnHeader}
                </ThemedText>
              </View>

              {keepComments.length === 0 ? (
                <ThemedText type="default" style={styles.emptyColumnText}>{Strings.retroBoard.emptyKeepText}</ThemedText>
              ) : (
                keepComments.map(comment => (
                  <View
                    key={comment.id}
                    style={[styles.commentCard, { backgroundColor: keepBg, borderRightColor: '#2e7d32' }, getShadow(0.03, 3, 2)]}
                  >
                    <ThemedText type="default" style={[styles.commentContent, { color: keepText }]}>
                      {comment.content}
                    </ThemedText>
                    
                    <View style={styles.commentMeta}>
                      {comment.isAnonymous ? (
                        <ThemedText style={[styles.metaText, { fontStyle: 'italic', color: '#ff8f00' }]}>
                          {comment.author.username !== 'Anonymous' && isAdmin
                            ? Strings.retroBoard.anonymousByAdmin(comment.author.username)
                            : Strings.retroBoard.anonymousAuthor}
                        </ThemedText>
                      ) : (
                        <ThemedText style={[styles.metaText, { color: keepMetaText }]}>
                          {`@${comment.author.username}`}
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.metaText, { opacity: 0.5, color: keepMetaText }]}>
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Column 2: IMPROVE */}
            <View style={styles.column}>
              <View style={[styles.columnHeader, { backgroundColor: 'rgba(198, 40, 40, 0.08)', borderColor: '#c62828' }]}>
                <ThemedText type="default" style={{ fontWeight: 'bold', color: '#c62828' }}>
                  {Strings.retroBoard.improveColumnHeader}
                </ThemedText>
              </View>

              {improveComments.length === 0 ? (
                <ThemedText type="default" style={styles.emptyColumnText}>{Strings.retroBoard.emptyImproveText}</ThemedText>
              ) : (
                improveComments.map(comment => (
                  <View
                    key={comment.id}
                    style={[styles.commentCard, { backgroundColor: improveBg, borderRightColor: '#c62828' }, getShadow(0.03, 3, 2)]}
                  >
                    <ThemedText type="default" style={[styles.commentContent, { color: improveText }]}>
                      {comment.content}
                    </ThemedText>
                    
                    <View style={styles.commentMeta}>
                      {comment.isAnonymous ? (
                        <ThemedText style={[styles.metaText, { fontStyle: 'italic', color: '#ff8f00' }]}>
                          {comment.author.username !== 'Anonymous' && isAdmin
                            ? Strings.retroBoard.anonymousByAdmin(comment.author.username)
                            : Strings.retroBoard.anonymousAuthor}
                        </ThemedText>
                      ) : (
                        <ThemedText style={[styles.metaText, { color: improveMetaText }]}>
                          {`@${comment.author.username}`}
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.metaText, { opacity: 0.5, color: improveMetaText }]}>
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  container: {
    width: '100%',
    maxWidth: 1100,
    gap: Spacing.three,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
  backButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  titleContainer: {
    gap: 2,
    marginTop: Spacing.one,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'right',
  },
  description: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  postSection: {
    padding: Spacing.three,
    borderRadius: 10,
    gap: Spacing.two,
  },
  wheelWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    marginVertical: Spacing.two,
  },
  yinYangWheel: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#ffffff',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelHalf: {
    position: 'absolute',
    width: '100%',
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepHalf: {
    top: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  improveHalf: {
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  wheelCenter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 10,
  },
  wheelLabelContainer: {
    alignItems: 'flex-end',
  },
  textarea: {
    height: 60,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  formControls: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  anonControl: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.one,
  },
  submitButton: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  loaderContainer: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  columnsContainer: {
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  column: {
    flex: 1,
    gap: Spacing.three,
  },
  columnHeader: {
    padding: Spacing.two,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyColumnText: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'center',
    marginVertical: Spacing.two,
    fontStyle: 'italic',
  },
  commentCard: {
    padding: Spacing.three,
    borderRadius: 8,
    borderRightWidth: 5,
    gap: Spacing.two,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'right',
  },
  commentMeta: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
    paddingTop: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.two,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 13,
    textAlign: 'center',
  },
});
