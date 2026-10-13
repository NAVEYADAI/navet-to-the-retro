import { BadRequestException } from '@nestjs/common';
import { MAX_LOGO_BYTES, assertValidLogoFile, detectImageType, parseAccentHue } from './team-logo.util';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'latin1');
const GIF = Buffer.from('GIF89a', 'latin1');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('team logo upload validation (feature 19)', () => {
  describe('detectImageType', () => {
    it('recognises PNG and JPEG by magic bytes', () => {
      expect(detectImageType(PNG)).toBe('image/png');
      expect(detectImageType(JPEG)).toBe('image/jpeg');
    });

    it.each([['WebP', WEBP], ['GIF', GIF], ['SVG', SVG], ['empty', Buffer.alloc(0)], ['truncated PNG header', PNG.subarray(0, 4)]])(
      'rejects %s',
      (_name, buf) => {
        expect(detectImageType(buf as Buffer)).toBeNull();
      }
    );
  });

  describe('assertValidLogoFile', () => {
    it('returns the detected type for a valid file', () => {
      expect(assertValidLogoFile({ buffer: PNG })).toEqual({ buffer: PNG, contentType: 'image/png' });
    });

    it('trusts the bytes, not the client: a file that merely claims to be an image is rejected', () => {
      expect(() => assertValidLogoFile({ buffer: SVG })).toThrow(BadRequestException);
    });

    it.each([undefined, null, {}, { buffer: Buffer.alloc(0) }])('rejects a missing/empty file %j', (file) => {
      expect(() => assertValidLogoFile(file as any)).toThrow(BadRequestException);
    });

    it('accepts a file of exactly the size limit and rejects one byte more', () => {
      const atLimit = Buffer.concat([PNG, Buffer.alloc(MAX_LOGO_BYTES - PNG.length)]);
      expect(() => assertValidLogoFile({ buffer: atLimit })).not.toThrow();
      expect(() => assertValidLogoFile({ buffer: Buffer.concat([atLimit, Buffer.alloc(1)]) })).toThrow(BadRequestException);
    });
  });

  describe('parseAccentHue', () => {
    it.each([[undefined, null], [null, null], ['', null], ['0', 0], ['359', 359], [172, 172], ['172', 172]])(
      'parses %j as %j',
      (raw, expected) => {
        expect(parseAccentHue(raw)).toBe(expected);
      }
    );

    it.each(['360', '-1', '1.5', 'abc', '1e2', 360, -1, 1.5, NaN, {}, true])('rejects %j', (raw) => {
      expect(() => parseAccentHue(raw)).toThrow(BadRequestException);
    });
  });
});
