import { SxProps, Theme } from '@mui/material';

export const getSettingsCardSx = (isDark: boolean): SxProps<Theme> => ({
  backgroundColor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(16px)',
  borderRadius: '24px',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
  boxShadow: isDark
    ? '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
    : '0 12px 40px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
  transition: 'all 0.3s ease',
});

export const getSettingsInputSx = (themeColors: { text: string; textSecondary: string; backgroundElement: string; backgroundSelected: string }): SxProps<Theme> => ({
  direction: 'rtl',
  width: '100%',
  '& .MuiOutlinedInput-root': {
    backgroundColor: themeColors.backgroundElement,
    borderRadius: '12px',
    '& fieldset': { borderColor: themeColors.backgroundSelected },
    '&:hover fieldset': { borderColor: themeColors.text },
    '&.Mui-focused fieldset': { borderColor: themeColors.text, borderWidth: '1.5px' },
  },
  '& .MuiInputLabel-root': { display: 'none' },
  '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
  '& .MuiInputBase-input': {
    color: themeColors.text,
    textAlign: 'right',
    fontFamily: 'Rubik, sans-serif',
    py: 1.2,
    '&::placeholder': {
      color: themeColors.textSecondary,
      opacity: 1,
    },
  },
});

export const primaryButtonSx = (accentColor: string): SxProps<Theme> => ({
  backgroundColor: accentColor,
  color: '#ffffff',
  fontWeight: 700,
  fontFamily: 'Rubik, sans-serif',
  borderRadius: '12px',
  py: 1.2,
  px: 3,
  boxShadow: `0 4px 14px ${accentColor}40`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: accentColor,
    boxShadow: `0 6px 20px ${accentColor}60`,
    transform: 'translateY(-1px)',
  },
});
