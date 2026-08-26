import React, { useState, useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { motion, AnimatePresence } from 'framer-motion';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { CommentCardWeb } from './comment-card-web';
import { RetroWheelToggle } from './retro-wheel-toggle';
import { CommentFilterBarWeb } from './comment-filter-bar-web';
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
  MenuItem,
  Menu,
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
  const [category, setCategory] = useState('');
  const [categoryMenuAnchor, setCategoryMenuAnchor] = useState<HTMLElement | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comment list filters (distinct from the compose-form state above)
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');

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
        category: category || undefined,
        isAnonymous
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setContent('');
      setCategory('');
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

  const matchesFilters = (c: any) =>
    (filterCategories.length === 0 || filterCategories.includes(c.category)) &&
    (!filterText.trim() || c.content?.toLowerCase().includes(filterText.trim().toLowerCase()));

  const keepComments = comments.filter(c => c.type === 'KEEP' && matchesFilters(c));
  const improveComments = comments.filter(c => c.type === 'IMPROVE' && matchesFilters(c));
  const isFilterActive = filterCategories.length > 0 || !!filterText.trim();

  const isDark = useRNColorScheme() === 'dark';
  const accent = isDark ? '#818cf8' : '#6366f1';
  const typeColor = type === 'KEEP' ? '#00e676' : '#ff1744';
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
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: isAnonymous ? '#161618' : boardCardSx.backgroundColor,
            border: isAnonymous
              ? '2.5px solid #8b5cf6'
              : type === 'KEEP' ? '2.5px solid #00e676' : '2.5px solid #ff1744',
            boxShadow: isAnonymous
              ? '0 0 25px rgba(139,92,246,0.4), inset 0 0 30px rgba(0,0,0,0.5)'
              : type === 'KEEP'
              ? '0 0 25px rgba(0,230,118,0.35), inset 0 0 15px rgba(0,230,118,0.08)'
              : '0 0 25px rgba(255,23,68,0.35), inset 0 0 15px rgba(255,23,68,0.08)',
            transition: 'background-color 0.4s ease, border 0.4s ease, box-shadow 0.4s ease',
          }}>
            {isAnonymous && (
              <Box aria-hidden sx={{
                position: 'absolute',
                top: -24,
                left: -24,
                fontSize: 150,
                opacity: 0.07,
                pointerEvents: 'none',
                userSelect: 'none',
                lineHeight: 1,
              }}>
                🥸
              </Box>
            )}
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right', position: 'relative' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: isAnonymous ? '#e8eaed' : theme.text, fontFamily: 'Rubik, sans-serif', transition: 'color 0.3s ease' }}>
                {isAnonymous ? `🥸 ${Strings.retroBoard.writeNoteHeader}` : `✍️ ${Strings.retroBoard.writeNoteHeader}`}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right', borderRadius: '12px', fontFamily: 'Rubik, sans-serif' }}>
                  {error}
                </Alert>
              )}

              {/* KEEP / IMPROVE toggle */}
              <RetroWheelToggle type={type} toggleType={toggleType} theme={theme} />

              <TextField
                multiline
                rows={3}
                placeholder={type === 'KEEP' ? Strings.retroBoard.notePlaceholderKeep : Strings.retroBoard.notePlaceholderImprove}
                value={content}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContent(e.target.value)}
                sx={{
                  textarea: {
                    color: isAnonymous ? '#e8eaed' : theme.text,
                    textAlign: 'right',
                    fontFamily: 'Rubik, sans-serif',
                    '&::placeholder': { color: isAnonymous ? 'rgba(232,234,237,0.5)' : undefined, opacity: 1 },
                  },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: isAnonymous ? 'rgba(255,255,255,0.04)' : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: isAnonymous ? '#8b5cf6' : accent },
                    '&.Mui-focused fieldset': { borderColor: isAnonymous ? '#8b5cf6' : accent, borderWidth: 2 },
                    fieldset: { borderColor: isAnonymous ? 'rgba(139,92,246,0.3)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                  }
                }}
              />

              <Box sx={{ alignSelf: 'flex-start' }}>
                <Box
                  component="button"
                  type="button"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => setCategoryMenuAnchor(e.currentTarget)}
                  sx={{
                    display: 'inline-flex',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 0.9,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Rubik, sans-serif',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: category ? (isAnonymous ? '#e8eaed' : accent) : theme.textSecondary,
                    background: category
                      ? isAnonymous ? 'rgba(139,92,246,0.18)' : `${accent}17`
                      : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
                    padding: '6px 10px 6px 14px',
                    borderRadius: '10px 4px 10px 4px',
                    transition: 'background 0.2s ease, color 0.2s ease',
                    '&:hover': {
                      background: category
                        ? isAnonymous ? 'rgba(139,92,246,0.26)' : `${accent}26`
                        : isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)',
                    },
                  }}
                >
                  <Box
                    component="svg"
                    viewBox="0 0 24 24"
                    sx={{ width: 13, height: 13, flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}
                  >
                    <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83Z" />
                    <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
                  </Box>
                  {category ? Strings.retroBoard.categories[category] : Strings.retroBoard.categoryLabel}
                </Box>

                <Menu
                  anchorEl={categoryMenuAnchor}
                  open={!!categoryMenuAnchor}
                  onClose={() => setCategoryMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{
                    paper: {
                      sx: {
                        direction: 'rtl',
                        mt: 0.7,
                        minWidth: 210,
                        maxHeight: 360,
                        borderRadius: '14px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                        overflowY: 'auto',
                        scrollbarColor: `${typeColor} transparent`,
                        scrollbarWidth: 'thin',
                        '&::-webkit-scrollbar': { width: 6 },
                        '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
                        '&::-webkit-scrollbar-thumb': { backgroundColor: typeColor, borderRadius: 3 },
                      },
                    },
                  }}
                >
                  <MenuItem
                    onClick={() => { setCategory(''); setCategoryMenuAnchor(null); }}
                    sx={{ justifyContent: 'space-between', fontFamily: 'Rubik, sans-serif', fontSize: 13, color: theme.textSecondary, fontStyle: 'italic' }}
                  >
                    {Strings.retroBoard.categoryNone}
                    {category === '' && <Box component="span" sx={{ color: typeColor, fontSize: 14 }}>✓</Box>}
                  </MenuItem>
                  {Object.entries(Strings.retroBoard.categories).map(([key, label]) => (
                    <MenuItem
                      key={key}
                      selected={category === key}
                      onClick={() => { setCategory(key); setCategoryMenuAnchor(null); }}
                      sx={{ justifyContent: 'space-between', fontFamily: 'Rubik, sans-serif', fontSize: 13 }}
                    >
                      {label}
                      {category === key && <Box component="span" sx={{ color: typeColor, fontSize: 14 }}>✓</Box>}
                    </MenuItem>
                  ))}
                </Menu>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <motion.button
                  type="button"
                  aria-pressed={isAnonymous}
                  aria-label={Strings.retroBoard.anonymousToggleHint}
                  onClick={() => setIsAnonymous((prev) => !prev)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isAnonymous
                      ? 'linear-gradient(135deg, #3c4043 0%, #161618 100%)'
                      : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.05)',
                    border: isAnonymous ? '1.5px solid #8b5cf6' : '1.5px solid transparent',
                    boxShadow: isAnonymous ? '0 0 14px rgba(139,92,246,0.5)' : 'none',
                    transition: 'background 0.3s ease, box-shadow 0.3s ease, border 0.3s ease',
                  }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isAnonymous ? 'anon' : 'public'}
                      initial={{ opacity: 0, rotate: -20, scale: 0.6 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 20, scale: 0.6 }}
                      transition={{ duration: 0.18 }}
                      style={{ fontSize: 18, lineHeight: 1 }}
                    >
                      {isAnonymous ? '🥸' : '👤'}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>

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

        {/* Filters */}
        {!isLoading && comments.length > 0 && (
          <Fade in={true} timeout={500}>
            <Box>
              <CommentFilterBarWeb
                categories={filterCategories}
                onCategoriesChange={setFilterCategories}
                searchText={filterText}
                onSearchTextChange={setFilterText}
                theme={theme}
              />
            </Box>
          </Fade>
        )}

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
                    {isFilterActive ? Strings.retroBoard.noMatchingCommentsText : Strings.retroBoard.emptyKeepText}
                  </Typography>
                ) : (
                  keepComments.map((comment, index) => (
                    <CommentCardWeb key={comment.id} comment={comment} index={index} theme={theme} />
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
                    {isFilterActive ? Strings.retroBoard.noMatchingCommentsText : Strings.retroBoard.emptyImproveText}
                  </Typography>
                ) : (
                  improveComments.map((comment, index) => (
                    <CommentCardWeb key={comment.id} comment={comment} index={index} theme={theme} />
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
