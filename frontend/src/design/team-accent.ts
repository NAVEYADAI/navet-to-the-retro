/**
 * Feature 19 (product-backlog/19-team-logo.md §19.0 design decision #1): צבע הצוות נגזר מגוון
 * (hue) הלוגו בלבד; רוויה ובהירות קבועות, כך שכל צוות נראה חלק מאותה מערכת והטקסט הלבן על `base`
 * תמיד ב-4.5:1 לפחות.
 *
 * זה העותק של הלקוח; ייצוא המצגת נבנה בשרת ולכן יש עותק זהה ב-
 * backend/src/teams/team-accent.util.ts. שניהם נעולים באותם ערכי golden בבדיקות — לשנות יחד.
 */
import type { ThemeMode } from './tokens';

export interface TeamAccent {
  subtle: string;
  border: string;
  base: string;
  hover: string;
  onBase: string;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function toHex([r, g, b]: [number, number, number]): string {
  const part = (x: number) => x.toString(16).padStart(2, '0').toUpperCase();
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function normalizeHue(hue: number): number {
  return ((Math.round(hue) % 360) + 360) % 360;
}

export function teamAccentFromHue(hue: number, mode: ThemeMode = 'light'): TeamAccent {
  const h = normalizeHue(hue);
  if (mode === 'dark') {
    const [r, g, b] = hslToRgb(h, 40, 62);
    return {
      subtle: `rgba(${r},${g},${b},0.12)`,
      border: `rgba(${r},${g},${b},0.28)`,
      base: toHex([r, g, b]),
      hover: toHex(hslToRgb(h, 40, 70)),
      onBase: '#0A0D12',
    };
  }
  return {
    subtle: toHex(hslToRgb(h, 75, 95)),
    border: toHex(hslToRgb(h, 55, 85)),
    base: toHex(hslToRgb(h, 62, 28)),
    hover: toHex(hslToRgb(h, 62, 21)),
    onBase: '#FFFFFF',
  };
}

/** צבע הלוגו עצמו (לסימן מים / הדגשה), לא לטקסט: בהיר ורווי יותר מ-`base`. */
export function teamLogoTint(hue: number, mode: ThemeMode = 'light'): string {
  const h = normalizeHue(hue);
  return toHex(hslToRgb(h, 66, mode === 'dark' ? 52 : 40));
}
