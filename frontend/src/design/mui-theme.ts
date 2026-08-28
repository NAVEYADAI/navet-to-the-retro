import { createTheme } from '@mui/material/styles';
import type { AppTheme } from './tokens';

/**
 * גורם ל-MUI לדבר בטוקנים שלנו, כדי שגם קומפוננטת MUI שלא עטופה
 * ב-ui/ תיראה נכון. אין sx עם hex בשום מסך.
 */
export function createMuiTheme(t: AppTheme) {
  return createTheme({
    direction: 'rtl',
    palette: {
      mode: t.mode,
      primary: { main: t.color.accent.base, dark: t.color.accent.hover, contrastText: t.color.accent.onBase },
      error: { main: t.color.status.danger.fg },
      warning: { main: t.color.status.warning.fg },
      success: { main: t.color.status.success.fg },
      background: { default: t.color.bg, paper: t.color.surface },
      text: { primary: t.color.text, secondary: t.color.textSecondary },
      divider: t.color.border,
    },
    typography: {
      fontFamily: t.type.body.fontFamily,
      h1: t.type.pageTitle,
      h2: t.type.sectionTitle,
      h6: t.type.cardTitle,
      body1: t.type.body,
      body2: t.type.caption,
      button: { ...t.type.bodyStrong, textTransform: 'none' },
    },
    shape: { borderRadius: t.radius.field },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: t.radius.field, paddingBlock: 10, paddingInline: 18 } },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: t.radius.card,
            border: `1px solid ${t.color.border}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: t.radius.field, backgroundColor: t.color.surface },
        },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: t.radius.field } } },
    },
  });
}
