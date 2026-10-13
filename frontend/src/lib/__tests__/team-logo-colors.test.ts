import { extractHueCandidates } from '@/lib/team-logo-colors';

/** בונה RGBA של ריבוע בצבע אחד: `count` פיקסלים. */
function pixels(count: number, rgba: [number, number, number, number]): number[] {
  return Array.from({ length: count }, () => rgba).flat();
}

describe('extractHueCandidates (feature 19)', () => {
  it('finds the dominant hue of a single-colour logo', () => {
    // teal-ish (172°): rgb(31,164,148)
    const [hue] = extractHueCandidates(pixels(100, [31, 164, 148, 255]));
    expect(hue).toBeGreaterThanOrEqual(168);
    expect(hue).toBeLessThanOrEqual(176);
  });

  it.each([
    ['black', [10, 10, 10, 255]],
    ['white', [255, 255, 255, 255]],
    ['mid grey', [128, 128, 128, 255]],
    ['near-grey with a whisper of colour', [120, 128, 124, 255]],
  ] as const)('a %s logo has no dominant hue → no team colour', (_name, px) => {
    expect(extractHueCandidates(pixels(200, [...px] as [number, number, number, number]))).toEqual([]);
  });

  it('ignores transparent pixels (a transparent PNG with a small coloured mark)', () => {
    const data = [...pixels(900, [255, 0, 0, 0]), ...pixels(100, [20, 80, 220, 255])];
    const [hue] = extractHueCandidates(data);
    expect(hue).toBeGreaterThanOrEqual(215);
    expect(hue).toBeLessThanOrEqual(225);
  });

  it('ignores a white background around a coloured mark', () => {
    const data = [...pixels(800, [255, 255, 255, 255]), ...pixels(200, [230, 90, 20, 255])];
    const [hue] = extractHueCandidates(data);
    expect(hue).toBeGreaterThanOrEqual(15);
    expect(hue).toBeLessThanOrEqual(25);
  });

  it('ranks by prominence and returns distinct candidates (>=40° apart), at most 3', () => {
    const data = [
      ...pixels(500, [31, 164, 148, 255]), // ~172° — dominant
      ...pixels(300, [230, 90, 20, 255]), // ~20°
      ...pixels(150, [33, 150, 243, 255]), // ~207° — within 40° of 172°? 35° apart → merged away
      ...pixels(100, [150, 30, 200, 255]), // ~284°
      ...pixels(90, [200, 30, 60, 255]), // ~348°
    ];
    const hues = extractHueCandidates(data);
    expect(hues.length).toBeLessThanOrEqual(3);
    expect(hues[0]).toBeGreaterThanOrEqual(168);
    expect(hues[0]).toBeLessThanOrEqual(176);
    for (let i = 0; i < hues.length; i += 1) {
      for (let j = i + 1; j < hues.length; j += 1) {
        const d = Math.abs(hues[i] - hues[j]);
        expect(Math.min(d, 360 - d)).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('averages a hue that straddles 0°/360° correctly (reds on both sides)', () => {
    const data = [...pixels(100, [220, 30, 50, 255]), ...pixels(100, [220, 45, 25, 255])];
    const [hue] = extractHueCandidates(data);
    const dist = Math.min(hue, 360 - hue);
    expect(dist).toBeLessThanOrEqual(15);
  });

  it('drops noise: a handful of stray coloured pixels do not become a candidate', () => {
    const data = [...pixels(1000, [31, 164, 148, 255]), ...pixels(5, [230, 90, 20, 255])];
    expect(extractHueCandidates(data)).toHaveLength(1);
  });

  it('returns [] for empty / truncated input', () => {
    expect(extractHueCandidates([])).toEqual([]);
    expect(extractHueCandidates([255, 0, 0])).toEqual([]);
  });
});
