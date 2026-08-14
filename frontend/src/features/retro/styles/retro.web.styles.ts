import { SxProps, Theme } from '@mui/material';

export const getRetroContainerSx = (isDark: boolean): SxProps<Theme> => ({
  minHeight: '100vh',
  py: { xs: 3, sm: 5 },
  px: { xs: 2, sm: 3 },
  direction: 'rtl',
  background: isDark
    ? 'radial-gradient(ellipse at 50% 10%, rgba(99,102,241,0.15) 0%, transparent 60%), #0a0a0f'
    : 'radial-gradient(ellipse at 50% 10%, rgba(99,102,241,0.08) 0%, transparent 60%), #f8fafc',
});

export const getRetroBoardCardSx = (isDark: boolean): SxProps<Theme> => ({
  backgroundColor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(16px)',
  borderRadius: '24px',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
  boxShadow: isDark
    ? '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
    : '0 12px 40px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
});
