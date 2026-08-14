import { SxProps, Theme } from '@mui/material';

export const getAuthContainerSx = (isDark: boolean): SxProps<Theme> => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 2,
  direction: 'rtl',
  background: isDark
    ? 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.18) 0%, rgba(15,23,42,0.8) 50%, #090d16 100%)'
    : 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.12) 0%, rgba(241,245,249,0.8) 50%, #f8fafc 100%)',
});

export const getAuthCardSx = (isDark: boolean): SxProps<Theme> => ({
  width: '100%',
  maxWidth: 440,
  backgroundColor: isDark ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(32px)',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.12)'}`,
  borderRadius: '28px',
  p: { xs: 3.5, sm: 4.5 },
  boxShadow: isDark
    ? '0 25px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)'
    : '0 25px 70px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
  animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
});

export const getAuthTextFieldSx = (isDark: boolean): SxProps<Theme> => {
  const accent = isDark ? '#818cf8' : '#6366f1';
  const glowColor = isDark ? 'rgba(129,140,248,0.25)' : 'rgba(99,102,241,0.18)';

  return {
    direction: 'rtl',
    width: '100%',
    '& .MuiOutlinedInput-root': {
      fontFamily: 'Rubik, sans-serif',
      fontSize: 14,
      fontWeight: 500,
      color: isDark ? '#f8fafc' : '#0f172a',
      borderRadius: '16px',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(12px)',
      boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '& fieldset': {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.15)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      '&:hover fieldset': {
        borderColor: isDark ? 'rgba(129, 140, 248, 0.5)' : 'rgba(99, 102, 241, 0.5)',
      },
      '&.Mui-focused': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
        boxShadow: `0 0 0 4px ${glowColor}, 0 10px 25px -5px ${glowColor}`,
      },
      '&.Mui-focused fieldset': {
        borderColor: accent,
        borderWidth: '1.5px',
      },
    },
    '& .MuiInputLabel-root': { display: 'none' },
    '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
    '& .MuiInputBase-input': {
      textAlign: 'right',
      fontFamily: 'Rubik, sans-serif',
      py: 1.3,
      px: 2,
      '&::placeholder': {
        color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        opacity: 1,
      },
    },
  };
};
