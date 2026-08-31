/**
 * המקור היחיד לאמת לכל ה-UI.
 * אין hex, גופן, ריווח או רדיוס בשום קומפוננטה שלא מגיע מכאן.
 */

export const accentSchemes = {
  blue:     { subtle: '#EDF3FF', border: '#C7DBFF', base: '#0F62FE', hover: '#0043CE', onBase: '#FFFFFF' },
  cyan:     { subtle: '#E3F6FC', border: '#A9DEED', base: '#0B6E8C', hover: '#08536A', onBase: '#FFFFFF' },
  teal:     { subtle: '#E6F7F6', border: '#B2E4E0', base: '#0F766E', hover: '#0B5C56', onBase: '#FFFFFF' },
  green:    { subtle: '#E9F7F1', border: '#B6E3D0', base: '#0E8A5F', hover: '#0A6B49', onBase: '#FFFFFF' },
  amber:    { subtle: '#FFF3DC', border: '#F5D9A0', base: '#8A5A00', hover: '#6E4700', onBase: '#FFFFFF' },
  rose:     { subtle: '#FDEEF2', border: '#F6C9D4', base: '#B0184C', hover: '#8F1140', onBase: '#FFFFFF' },
  purple:   { subtle: '#F2EEFC', border: '#D8CBF5', base: '#6C4BD8', hover: '#5637B8', onBase: '#FFFFFF' },
  graphite: { subtle: '#F1F3F7', border: '#CDD2DC', base: '#10131A', hover: '#000000', onBase: '#FFFFFF' },
} as const;

/**
 * כל צבע נגזר מאותה נוסחת HSL (S 40%, L 52% / L 60% ל-hover) — רק ה-hue משתנה.
 * זה מבטיח בהירות ועוצמה זהות לכל הסכימות (שום גוון לא "קופץ" יותר מהשני),
 * ורוויה נמוכה מספיק כדי שהניגודיות מול הרקע הכהה תישאר רכה ולא חדה.
 */
export const accentSchemesDark = {
  blue:     { subtle: 'rgba(84,118,182,0.10)',  border: 'rgba(84,118,182,0.22)',  base: '#5476B6', hover: '#708DC2', onBase: '#0A0D12' },
  cyan:     { subtle: 'rgba(84,159,182,0.10)',  border: 'rgba(84,159,182,0.22)',  base: '#549FB6', hover: '#70AFC2', onBase: '#0A0D12' },
  teal:     { subtle: 'rgba(84,182,173,0.10)',  border: 'rgba(84,182,173,0.22)',  base: '#54B6AD', hover: '#70C2BB', onBase: '#0A0D12' },
  green:    { subtle: 'rgba(84,182,147,0.10)',  border: 'rgba(84,182,147,0.22)',  base: '#54B693', hover: '#70C2A5', onBase: '#0A0D12' },
  amber:    { subtle: 'rgba(182,147,84,0.10)',  border: 'rgba(182,147,84,0.22)',  base: '#B69354', hover: '#C2A570', onBase: '#0A0D12' },
  rose:     { subtle: 'rgba(182,84,117,0.10)',  border: 'rgba(182,84,117,0.22)',  base: '#B65475', hover: '#C2708C', onBase: '#0A0D12' },
  purple:   { subtle: 'rgba(106,84,182,0.10)',  border: 'rgba(106,84,182,0.22)',  base: '#6A54B6', hover: '#8370C2', onBase: '#0A0D12' },
  graphite: { subtle: 'rgba(125,130,140,0.10)', border: 'rgba(125,130,140,0.22)', base: '#7D828C', hover: '#93979F', onBase: '#0A0D12' },
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
  /** מסך רקע מעומעם מאחורי מודאל/שכבת-על (native בעיקר, אין `dir=rtl` שקוף לזה). */
  overlay: 'rgba(16,19,26,0.4)',
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
  overlay: 'rgba(0,0,0,0.6)',
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

/** גדלי אייקון בלבד. אין מספר פיקסלים חופשי בשום `<Icon>`. */
export const iconSize = { sm: 14, md: 18, lg: 22 } as const;

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
    iconSize,
    shadow: mode === 'dark'
      ? { none: 'none', sm: '0 1px 2px rgba(0,0,0,0.4)', md: '0 6px 18px rgba(0,0,0,0.5)' }
      : shadow,
    layout,
    motion,
  };
}

export type AppTheme = ReturnType<typeof buildTheme>;
