import UPNG from 'upng-js';
import { base64ToBytes, centredSquareCrop, huesFromPngBytes } from '@/features/teams/team-logo-pipeline';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(), SaveFormat: { PNG: 'png' } }));

// upng-js ships no types; encode() is only needed here to fabricate real PNG files.
const encodePng = (rgba: Uint8Array, w: number, h: number): Uint8Array =>
  new Uint8Array((UPNG as any).encode([rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength)], w, h, 0));

const solid = (w: number, h: number, [r, g, b, a]: [number, number, number, number]) => {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a; }
  return data;
};

describe('team logo pipeline (feature 19)', () => {
  describe('centredSquareCrop', () => {
    it.each([
      [800, 600, { originX: 100, originY: 0, width: 600, height: 600 }],
      [600, 800, { originX: 0, originY: 100, width: 600, height: 600 }],
      [500, 500, { originX: 0, originY: 0, width: 500, height: 500 }],
      [801, 600, { originX: 100, originY: 0, width: 600, height: 600 }],
    ])('%ix%i → centred square', (w, h, expected) => {
      expect(centredSquareCrop(w, h)).toEqual(expected);
    });
  });

  describe('base64ToBytes', () => {
    it('decodes base64 to the original bytes', () => {
      expect(Array.from(base64ToBytes('AQID/w=='))).toEqual([1, 2, 3, 255]);
      expect(base64ToBytes('')).toHaveLength(0);
    });
  });

  describe('huesFromPngBytes', () => {
    it('reads the dominant hue out of a real PNG', () => {
      // teal rgb(31,164,148) ≈ 172°
      const [hue] = huesFromPngBytes(encodePng(solid(16, 16, [31, 164, 148, 255]), 16, 16));
      expect(hue).toBeGreaterThanOrEqual(168);
      expect(hue).toBeLessThanOrEqual(176);
    });

    it('a black or white logo has no hue (→ no team colour)', () => {
      expect(huesFromPngBytes(encodePng(solid(16, 16, [0, 0, 0, 255]), 16, 16))).toEqual([]);
      expect(huesFromPngBytes(encodePng(solid(16, 16, [255, 255, 255, 255]), 16, 16))).toEqual([]);
    });

    it('a fully transparent PNG has no hue', () => {
      expect(huesFromPngBytes(encodePng(solid(16, 16, [20, 80, 220, 0]), 16, 16))).toEqual([]);
    });

    it('never throws on input that is not a PNG (e.g. a JPEG stored by a non-client upload)', () => {
      expect(huesFromPngBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).toEqual([]);
      expect(huesFromPngBytes(new Uint8Array(0))).toEqual([]);
    });
  });
});
