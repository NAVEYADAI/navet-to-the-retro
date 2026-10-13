import { BadRequestException } from '@nestjs/common';

// Feature 19 (product-backlog/19-team-logo.md §19.0 technical default #3/#4): the server never
// trusts the client's Content-Type/extension — the type is read off the file's magic bytes.
// PNG and JPEG only: SVG can carry script, and WebP isn't reliably supported by pptxgenjs /
// PowerPoint / Keynote. The client always re-encodes to a 256x256 PNG before uploading.
export const MAX_LOGO_BYTES = 512 * 1024;

export type LogoContentType = 'image/png' | 'image/jpeg';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(buffer: Buffer, signature: number[]): boolean {
  return buffer.length >= signature.length && signature.every((byte, i) => buffer[i] === byte);
}

export function detectImageType(buffer: Buffer): LogoContentType | null {
  if (startsWith(buffer, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(buffer, JPEG_SIGNATURE)) return 'image/jpeg';
  return null;
}

// Validates an uploaded file and returns the content type to store.
export function assertValidLogoFile(file: { buffer?: Buffer; size?: number } | undefined | null): {
  buffer: Buffer;
  contentType: LogoContentType;
} {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('לא נבחר קובץ');
  }
  if (file.buffer.length > MAX_LOGO_BYTES) {
    throw new BadRequestException('הקובץ גדול מדי (עד 512KB)');
  }
  const contentType = detectImageType(file.buffer);
  if (!contentType) {
    throw new BadRequestException('סוג הקובץ לא נתמך, יש להעלות PNG או JPG');
  }
  return { buffer: file.buffer, contentType };
}

// `accentHue` arrives either as a multipart text field (string) or a JSON body (number/null).
// '', null and undefined all mean "no team colour"; anything else must be an integer 0-359.
export function parseAccentHue(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'string' && /^\d{1,3}$/.test(raw) ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 359) {
    throw new BadRequestException('צבע הצוות לא תקין');
  }
  return n;
}
