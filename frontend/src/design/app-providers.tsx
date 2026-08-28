import React from 'react';
import { AppThemeProvider } from './theme-context';

/**
 * Native fallback for app-providers.web.tsx. MUI (ThemeProvider/CssBaseline) is DOM-only —
 * mounting it here would crash native. Native screens don't yet consume useTheme() for
 * rendering, but the provider itself is safe and cheap to keep mounted everywhere.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AppThemeProvider>{children}</AppThemeProvider>;
}
