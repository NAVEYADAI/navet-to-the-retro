import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';

// BUG-15: the project has no global ValidationPipe / class-validator (backend/AGENTS.md), so
// malformed input used to reach Prisma and surface as an opaque 500. These are the small explicit
// helpers services/controllers call instead — every failure is a BadRequestException (400) with
// a user-facing Hebrew message.

export const INT32_MAX = 2147483647;
export const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';

// Replaces ParseIntPipe on path ids: ParseIntPipe happily accepts "99999999999", which then
// overflows Prisma's Int32 column and returns 500. Only plain positive decimal ints that fit in
// Int32 pass ("12abc", "1.5", "-3", "0", "" are all 400).
export class IntIdPipe implements PipeTransform<string, number> {
  transform(value: string, _metadata?: ArgumentMetadata): number {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new BadRequestException('מזהה לא תקין');
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > INT32_MAX) {
      throw new BadRequestException('מזהה לא תקין');
    }
    return parsed;
  }
}

// Required, non-blank string. Returns the value unchanged (callers decide whether to trim).
export function requireNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  return value;
}

// Optional string: undefined (and null) are fine, anything else must be a string.
export function assertOptionalString(value: unknown, message: string): void {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new BadRequestException(message);
  }
}

export function assertOptionalBoolean(value: unknown, message: string): void {
  if (value !== undefined && value !== null && typeof value !== 'boolean') {
    throw new BadRequestException(message);
  }
}

// Optional positive Int32 (e.g. categoryId, onBehalfOfUserId, maxUses).
export function assertOptionalPositiveInt(value: unknown, message: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > INT32_MAX) {
    throw new BadRequestException(message);
  }
}

export function assertOptionalEnum(value: unknown, allowed: readonly string[], message: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new BadRequestException(message);
  }
}

// Strict date parsing: must be a string that `new Date()` can read. (A number or `true` would
// otherwise be silently coerced into a valid-looking Date.)
export function parseDateString(value: unknown, message = 'תאריך לא תקין'): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(message);
  }
  return date;
}

// Offset (ms) of `timeZone` from UTC at the given instant, e.g. +2h or +3h (DST) for Jerusalem.
function timeZoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  // `instant` has millisecond precision, the formatted parts don't — compare at second resolution.
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// BUG-32: an invite's `expiresAt` coming from a date picker is date-only ("2026-10-05"). A bare
// `new Date("2026-10-05")` is 00:00 UTC of that day, i.e. the link would die at the *start* of
// the chosen day (and picking "today" was rejected as already expired). Decision: a date-only
// value means the END of that calendar day in Israel time (23:59:59.999 Asia/Jerusalem — the
// app's single target locale), so "today" is accepted and "tomorrow" lives through tomorrow
// night. Any value that carries a time (full ISO string) is taken literally.
export function parseExpiryInput(value: unknown, message = 'תאריך התפוגה לא תקין'): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  const trimmed = value.trim();
  const match = DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    return parseDateString(trimmed, message);
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  // Reject rollovers like 2026-02-31.
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new BadRequestException(message);
  }
  const guess = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  // Two passes so the offset is taken at the resulting instant (handles days with a DST switch).
  let result = guess - timeZoneOffsetMs(guess, ISRAEL_TIME_ZONE);
  result = guess - timeZoneOffsetMs(result, ISRAEL_TIME_ZONE);
  return new Date(result);
}
