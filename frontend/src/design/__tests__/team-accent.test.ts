import { teamAccentFromHue, normalizeHue } from '@/design/team-accent';

// Golden values duplicated verbatim in backend/src/teams/team-accent.util.spec.ts — the server
// builds the PPTX with its own copy of the formula, and the two must never drift apart.
const GOLDEN: Array<[number, { subtle: string; border: string; base: string; hover: string }]> = [
  [0, { subtle: '#FCE9E9', border: '#EEC4C4', base: '#741B1B', hover: '#571414' }],
  [60, { subtle: '#FCFCE9', border: '#EEEEC4', base: '#74741B', hover: '#575714' }],
  [120, { subtle: '#E9FCE9', border: '#C4EEC4', base: '#1B741B', hover: '#145714' }],
  [172, { subtle: '#E9FCF9', border: '#C4EEE8', base: '#1B7468', hover: '#14574E' }],
  [240, { subtle: '#E9E9FC', border: '#C4C4EE', base: '#1B1B74', hover: '#141457' }],
  [300, { subtle: '#FCE9FC', border: '#EEC4EE', base: '#741B74', hover: '#571457' }],
];

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

describe('teamAccentFromHue (feature 19)', () => {
  it.each(GOLDEN)('light, hue %i matches the golden palette (same as the backend copy)', (hue, expected) => {
    expect(teamAccentFromHue(hue, 'light')).toEqual({ ...expected, onBase: '#FFFFFF' });
  });

  it('white text on light `base` clears 4.5:1 for every hue', () => {
    for (let hue = 0; hue < 360; hue += 1) {
      const ratio = 1.05 / (luminance(teamAccentFromHue(hue, 'light').base) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark `onBase` text clears 4.5:1 on dark `base` for every hue', () => {
    const onBase = luminance('#0A0D12');
    for (let hue = 0; hue < 360; hue += 1) {
      const base = luminance(teamAccentFromHue(hue, 'dark').base);
      expect((base + 0.05) / (onBase + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark mode mirrors the dark accent schemes: translucent subtle/border, same shape as light', () => {
    const a = teamAccentFromHue(172, 'dark');
    expect(Object.keys(a).sort()).toEqual(['base', 'border', 'hover', 'onBase', 'subtle']);
    expect(a.subtle).toMatch(/^rgba\(\d+,\d+,\d+,0\.12\)$/);
    expect(a.border).toMatch(/^rgba\(\d+,\d+,\d+,0\.28\)$/);
  });

  it('defaults to light and normalises out-of-range hues', () => {
    expect(teamAccentFromHue(172)).toEqual(teamAccentFromHue(172, 'light'));
    expect(teamAccentFromHue(360)).toEqual(teamAccentFromHue(0));
    expect(teamAccentFromHue(-60)).toEqual(teamAccentFromHue(300));
    expect(normalizeHue(725)).toBe(5);
  });
});
