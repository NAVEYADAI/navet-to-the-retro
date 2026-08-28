import React, { useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppThemeProvider, useTheme } from './theme-context';
import { createMuiTheme } from './mui-theme';

function MuiBridge({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const muiTheme = useMemo(() => createMuiTheme(t), [t]);
  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

/** עוטף את האפליקציה פעם אחת בשורש. אחרי זה כל קומפוננטה קוראת useTheme(). */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <MuiBridge>{children}</MuiBridge>
    </AppThemeProvider>
  );
}
