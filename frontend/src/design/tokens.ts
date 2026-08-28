/**
 * המקור היחיד לאמת לכל ה-UI.
 * אין hex, גופן, ריווח או רדיוס בשום קומפוננטה שלא מגיע מכאן.
 */

export const accentSchemes = {
  blue:     { subtle: '#EDF3FF', border: '#C7DBFF', base: '#0F62FE', hover: '#0043CE', onBase: '#FFFFFF' },
  green:    { subtle: '#E9F7F1', border: '#B6E3D0', base: '#0E8A5F', hover: '#0A6B49', onBase: '#FFFFFF' },
  purple:   { subtle: '#F2EEFC', border: '#D8CBF5', base: '#6C4BD8', hover: '#5637B8', onBase: '#FFFFFF' },
  graphite: { subtle: '#F1F3F7', border: '#CDD2DC', base: '#10131A', hover: '#000000', onBase: '#FFFFFF' },
} as const;

export const accentSchemesDark = {
  blue:     { subtle: 'rgba(69,137,255,0.14)',  border: 'rgba(69,137,255,0.32)',  base: '#4589FF', hover: '#78A9FF', onBase: '#0A0D12' },
  green:    { subtle: 'rgba(52,195,143,0.14)',  border: 'rgba(52,195,143,0.32)',  base: '#34C38F', hover: '#5BD3A7', onBase: '#0A0D12' },
  purple:   { subtle: 'rgba(160,132,246,0.14)', border: 'rgba(160,132,246,0.32)', base: '#A084F6', hover: '#B9A3FA', onBase: '#0A0D12' },
  graphite: { subtle: 'rgba(242,244,247,0.10)', border: 'rgba(242,244,247,0.24)', base: '#E7EAF0', hover: '#FFFFFF', onBase: '#0A0D12' },
} as const;

export type AccentScheme = keyof typeof accentSchemes;
export type ThemeMode = 'light' | 'dark';
export type Density = 'compact' | 'regular';

const lightNeutrals = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F3F7',
  surfaceHover: '#F7F8FA',
  border: '#E3E6EC',
  borderStrong: '#CDD2DC',
  text: '#10131A',
  textSecondary: '#5B6472',
  textMuted: '#8A93A2',
};

const darkNeutrals = {
  bg: '#0E1116',
  surface: '#161A21',
  surfaceSubtle: '#1C212A',
  surfaceHover: '#1C212A',
  border: '#262C36',
  borderStrong: '#39414E',
  text: '#F2F4F7',
  textSecondary: '#9AA3B2',
  textMuted: '#6F7A8A',
};

const lightStatus = {
  success: { fg: '#0E8A5F', bg: '#E6F6EF', border: '#B6E3D0' },
  warning: { fg: '#B25E00', bg: '#FFF3E2', border: '#F5D9AE' },
  danger:  { fg: '#C4262E', bg: '#FDECEC', border: '#F7C9C9' },
  neutral: { fg: '#5B6472', bg: '#F1F3F7', border: '#E3E6EC' },
};

const darkStatus = {
  success: { fg: '#34C38F', bg: 'rgba(52,195,143,0.12)',  border: 'rgba(52,195,143,0.28)' },
  warning: { fg: '#E8A33D', bg: 'rgba(232,163,61,0.12)',  border: 'rgba(232,163,61,0.28)' },
  danger:  { fg: '#F2777E', bg: 'rgba(242,119,126,0.12)', border: 'rgba(242,119,126,0.28)' },
  neutral: { fg: '#9AA3B2', bg: 'rgba(242,244,247,0.06)', border: 'rgba(242,244,247,0.14)' },
};

/** מצב ספרינט -> טון סמנטי. אין מיפוי צבעים בתוך קומפוננטת ספרינט. */
export const sprintTone = { active: 'success', upcoming: 'warning', closed: 'neutral' } as const;

export const font = {
  display: "'Rubik', system-ui, sans-serif",
  body: "'Heebo', system-ui, sans-serif",
};

/** הסקאלה כולה. אין font-size שלא מופיע כאן. */
export const type = {
  pageTitle:   { fontFamily: font.display, fontSize: 32, fontWeight: 800, lineHeight: 1.2,  letterSpacing: '-0.4px' },
  sectionTitle:{ fontFamily: font.display, fontSize: 22, fontWeight: 700, lineHeight: 1.3 },
  cardTitle:   { fontFamily: font.display, fontSize: 17, fontWeight: 600, lineHeight: 1.35 },
  rowTitle:    { fontFamily: font.display, fontSize: 16, fontWeight: 600, lineHeight: 1.4 },
  body:        { fontFamily: font.body,    fontSize: 15, fontWeight: 400, lineHeight: 1.6 },
  bodyStrong:  { fontFamily: font.body,    fontSize: 14, fontWeight: 600, lineHeight: 1.5 },
  label:       { fontFamily: font.body,    fontSize: 13, fontWeight: 600, lineHeight: 1.4 },
  caption:     { fontFamily: font.body,    fontSize: 12, fontWeight: 400, lineHeight: 1.45 },
  overline:    { fontFamily: font.display, fontSize: 11, fontWeight: 700, lineHeight: 1.3, letterSpacing: '0.6px' },
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

export const radius = { badge: 6, field: 8, card: 12, pill: 999 } as const;

export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgba(16,19,26,0.06)',
  md: '0 6px 18px rgba(16,19,26,0.08)',
};

export const layout = {
  container: 1240,
  pagePaddingInline: space[6],
  gridGap: space[4],
  navHeight: 60,
  minTouchTarget: 44,
};

export const motion = {
  fast: '0.15s ease',
  /** אין אנימציות כניסה למסך. transition רק על hover/focus/press. */
  enter: 'none',
};

export function buildTheme(mode: ThemeMode, scheme: AccentScheme, density: Density = 'regular') {
  const n = mode === 'dark' ? darkNeutrals : lightNeutrals;
  const accent = (mode === 'dark' ? accentSchemesDark : accentSchemes)[scheme];
  const k = density === 'compact' ? 0.75 : 1;
  return {
    mode,
    scheme,
    density,
    color: { ...n, accent, status: mode === 'dark' ? darkStatus : lightStatus },
    space: Object.fromEntries(
      Object.entries(space).map(([key, v]) => [key, Math.round(v * k)])
    ) as typeof space,
    type,
    radius,
    shadow: mode === 'dark'
      ? { none: 'none', sm: '0 1px 2px rgba(0,0,0,0.4)', md: '0 6px 18px rgba(0,0,0,0.5)' }
      : shadow,
    layout,
    motion,
  };
}

export type AppTheme = ReturnType<typeof buildTheme>;
