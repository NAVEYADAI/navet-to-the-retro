import React, { useState, useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { motion, AnimatePresence } from 'framer-motion';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { CommentCardWeb } from './comment-card-web';
import { RetroWheelToggle } from './retro-wheel-toggle';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  CircularProgress,
  Alert,
  Grid,
  Grow,
  Fade,
} from '@mui/material';

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

export function SprintRetroBoardWeb({ sprint, team, token, user, theme, onBack }: SprintRetroBoardProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New comment state
  const [content, setContent] = useState('');
  const [type, setType] = useState<'KEEP' | 'IMPROVE'>('KEEP');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const [clickSide, setClickSide] = useState<'left' | 'right'>('right');

  const toggleType = (e?: any) => {
    if (e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      setClickSide(clickX < rect.width / 2 ? 'left' : 'right');
    }
    setType(prev => prev === 'KEEP' ? 'IMPROVE' : 'KEEP');
  };

  const myMembership = team.members?.find((m: any) => m.userId === user.id);
  const isAdmin = myMembership?.isAdmin || false;

  const keepComments = comments.filter(c => c.type === 'KEEP');
  const improveComments = comments.filter(c => c.type === 'IMPROVE');

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
      minHeight: '100vh',
      background: isDark
        ? 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.04) 0%, transparent 50%), #0a0a0f'
        : 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.03) 0%, transparent 50%), #fafbff',
      pt: { xs: 13, md: 12 },
      pb: 6,
      direction: 'rtl',
    }}>
      <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 }, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {/* Header section (Unified Design with Settings) */}
        <Fade in={true} timeout={500}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column-reverse', sm: 'row-reverse' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 2.5, sm: 2 },
              mb: 5,
              pb: 3,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Box sx={{ textAlign: 'right', flex: 1 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 800,
                  color: theme.text,
                  fontFamily: 'Rubik, sans-serif',
                  letterSpacing: -0.5,
                  fontSize: { xs: '1.5rem', sm: '2.1rem' },
                }}
              >
                {sprint.name} 📋
              </Typography>
              <Typography
                sx={{
                  color: theme.textSecondary,
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: { xs: 13, sm: 14 },
                  mt: 0.5,
                }}
              >
                {`${team.name} • ${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
              </Typography>
              {sprint.description && (
                <Typography
                  sx={{
                    color: theme.text,
                    fontStyle: 'italic',
                    mt: 1.5,
                    fontFamily: 'Rubik, sans-serif',
                    opacity: 0.8,
                    fontSize: { xs: 13, sm: 14 },
                  }}
                >
                  {sprint.description}
                </Typography>
              )}
            </Box>

            <Button
              variant="outlined"
              onClick={onBack}
              sx={{
                alignSelf: { xs: 'flex-start', sm: 'center' },
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                color: theme.text,
                fontWeight: 700,
                fontFamily: 'Rubik, sans-serif',
                textTransform: 'none',
                borderRadius: '14px',
                px: 3,
                py: 1,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.25s ease',
                '&:hover': {
                  borderColor: accent,
                  backgroundColor: `${accent}12`,
                  color: accent,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 14px ${accent}25`,
                },
              }}
            >
              {Strings.retroBoard.backButton}
            </Button>
          </Box>
        </Fade>

        {/* Input Form */}
        <Grow in={true} timeout={500}>
          <Card sx={{
            ...boardCardSx,
            border: type === 'KEEP' ? '2.5px solid #00e676' : '2.5px solid #ff1744',
            boxShadow: type === 'KEEP'
              ? '0 0 25px rgba(0,230,118,0.35), inset 0 0 15px rgba(0,230,118,0.08)'
              : '0 0 25px rgba(255,23,68,0.35), inset 0 0 15px rgba(255,23,68,0.08)',
            transition: 'border 0.4s ease, box-shadow 0.4s ease',
          }}>
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
              <RetroWheelToggle type={type} toggleType={toggleType} clickSide={clickSide} theme={theme} />

              <TextField
                multiline
                rows={3}
                placeholder={type === 'KEEP' ? "מה עבד טוב? ציין הישגים..." : "מה אפשר לשפר? הצע שיפורים..."}
                value={content}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContent(e.target.value)}
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
                <Box
                  onClick={() => setIsAnonymous((prev) => !prev)}
                  sx={{
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isAnonymous ? '#a855f7' : theme.textSecondary,
                      fontFamily: 'Rubik, sans-serif',
                      transition: 'color 0.3s ease',
                    }}
                  >
                    {Strings.retroBoard.anonymousLabel}
                  </Typography>

                  <motion.div
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    style={{
                      width: 62,
                      height: 32,
                      borderRadius: 16,
                      padding: 3,
                      display: 'flex',
                      alignItems: 'center',
                      position: 'relative',
                      background: isAnonymous
                        ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
                        : isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.12)',
                      border: isAnonymous
                        ? '1.5px solid #c084fc'
                        : '1.5px solid transparent',
                      boxShadow: isAnonymous
                        ? '0 0 16px rgba(168,85,247,0.5), inset 0 2px 4px rgba(0,0,0,0.2)'
                        : 'inset 0 2px 4px rgba(0,0,0,0.2)',
                      transition: 'background 0.3s ease, boxShadow 0.3s ease, border 0.3s ease',
                    }}
                  >
                    <span style={{ position: 'absolute', right: 7, fontSize: 13, opacity: isAnonymous ? 1 : 0.4 }}>🕵️‍♂️</span>
                    <span style={{ position: 'absolute', left: 7, fontSize: 13, opacity: isAnonymous ? 0.4 : 1 }}>👤</span>

                    <motion.div
                      animate={{
                        x: isAnonymous ? 30 : 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 25,
                      }}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                      }}
                    >
                      <motion.span
                        key={isAnonymous ? 'anon' : 'public'}
                        initial={{ scale: 0.5, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        style={{ fontSize: 13 }}
                      >
                        {isAnonymous ? '🕵️‍♂️' : '👤'}
                      </motion.span>
                    </motion.div>
                  </motion.div>
                </Box>

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
          <Grid container spacing={4} direction={{ xs: 'column', md: 'row-reverse' } as any}>
            
            {/* Column 1: KEEP */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{
                  p: 1.8,
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                  textAlign: 'center',
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ffffff', fontFamily: 'Rubik, sans-serif', letterSpacing: -0.3 }}>
                    👍 {Strings.retroBoard.keepColumnHeader}
                  </Typography>
                </Box>

                {keepComments.length === 0 ? (
                  <Typography variant="body2" sx={{ textAlign: 'center', color: theme.textSecondary, fontStyle: 'italic', my: 2, fontFamily: 'Rubik, sans-serif' }}>
                    {Strings.retroBoard.emptyKeepText}
                  </Typography>
                ) : (
                  keepComments.map((comment, index) => (
                    <CommentCardWeb key={comment.id} comment={comment} index={index} isDark={isDark} isAdmin={isAdmin} />
                  ))
                )}
              </Box>
            </Grid>

            {/* Column 2: IMPROVE */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{
                  p: 1.8,
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #ff1744 0%, #b71c1c 100%)',
                  boxShadow: '0 4px 14px rgba(255,23,68,0.3)',
                  textAlign: 'center',
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ffffff', fontFamily: 'Rubik, sans-serif', letterSpacing: -0.3 }}>
                    🔧 {Strings.retroBoard.improveColumnHeader}
                  </Typography>
                </Box>

                {improveComments.length === 0 ? (
                  <Typography variant="body2" sx={{ textAlign: 'center', color: theme.textSecondary, fontStyle: 'italic', my: 2, fontFamily: 'Rubik, sans-serif' }}>
                    {Strings.retroBoard.emptyImproveText}
                  </Typography>
                ) : (
                  improveComments.map((comment, index) => (
                    <CommentCardWeb key={comment.id} comment={comment} index={index} isDark={isDark} isAdmin={isAdmin} />
                  ))
                )}
              </Box>
            </Grid>

          </Grid>
        )}

      </Container>
    </Box>
  );
}
