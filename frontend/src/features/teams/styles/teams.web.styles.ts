import { SxProps, Theme } from '@mui/material';

export const getTeamCardSx = (isDark: boolean): SxProps<Theme> => ({
  backgroundColor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(16px)',
  borderRadius: '24px',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
  boxShadow: isDark
    ? '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
    : '0 12px 40px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: isDark
      ? '0 16px 48px rgba(0,0,0,0.5)'
      : '0 16px 48px rgba(99,102,241,0.14)',
  },
});

export const getTeamSelectInputSx = (isDark: boolean): SxProps<Theme> => {
  const accent = isDark ? '#818cf8' : '#6366f1';
  return {
    direction: 'rtl',
    '& .MuiOutlinedInput-root': {
      fontFamily: 'Rubik, sans-serif',
      fontSize: 14,
      borderRadius: '14px',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
      color: isDark ? '#f3f4f6' : '#111827',
      backdropFilter: 'blur(8px)',
      '& fieldset': {
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      },
      '&:hover fieldset': {
        borderColor: accent,
      },
      '&.Mui-focused fieldset': {
        borderColor: accent,
      },
    },
    '& .MuiInputLabel-root': {
      fontFamily: 'Rubik, sans-serif',
      fontSize: 14,
      right: 14,
      left: 'auto',
      transformOrigin: 'top right',
    },
    '& .MuiOutlinedInput-notchedOutline legend': {
      textAlign: 'right',
      float: 'right',
    },
  };
};
