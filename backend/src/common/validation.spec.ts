import { BadRequestException } from '@nestjs/common';
import {
  IntIdPipe,
  parseDateString,
  parseExpiryInput,
  requireNonEmptyString,
  assertOptionalBoolean,
  assertOptionalEnum,
  assertOptionalPositiveInt,
  assertOptionalString,
} from './validation';

describe('validation helpers (BUG-15)', () => {
  describe('IntIdPipe', () => {
    const pipe = new IntIdPipe();

    it.each([['1', 1], ['42', 42], ['2147483647', 2147483647]])('accepts %s', (input, expected) => {
      expect(pipe.transform(input)).toBe(expected);
    });

    it.each(['99999999999', '2147483648', '0', '-1', '1.5', '12abc', '', ' 5', '1e3', 'abc'])('rejects %j with 400', (input) => {
      expect(() => pipe.transform(input)).toThrow(BadRequestException);
    });
  });

  it('requireNonEmptyString rejects non-strings and blank strings', () => {
    expect(requireNonEmptyString('x', 'm')).toBe('x');
    for (const bad of [undefined, null, '', '   ', 5, {}]) {
      expect(() => requireNonEmptyString(bad, 'm')).toThrow(BadRequestException);
    }
  });

  it('optional asserts allow undefined/null but reject wrong types', () => {
    expect(() => assertOptionalString(undefined, 'm')).not.toThrow();
    expect(() => assertOptionalString(null, 'm')).not.toThrow();
    expect(() => assertOptionalString(1, 'm')).toThrow(BadRequestException);
    expect(() => assertOptionalBoolean(false, 'm')).not.toThrow();
    expect(() => assertOptionalBoolean('yes', 'm')).toThrow(BadRequestException);
    expect(() => assertOptionalPositiveInt(3, 'm')).not.toThrow();
    for (const bad of [0, -1, 1.2, '3', 2147483648]) {
      expect(() => assertOptionalPositiveInt(bad, 'm')).toThrow(BadRequestException);
    }
    expect(() => assertOptionalEnum('KEEP', ['KEEP', 'IMPROVE'], 'm')).not.toThrow();
    expect(() => assertOptionalEnum('LOVE', ['KEEP', 'IMPROVE'], 'm')).toThrow(BadRequestException);
    expect(() => assertOptionalEnum(1, ['KEEP'], 'm')).toThrow(BadRequestException);
  });

  describe('parseDateString', () => {
    it('parses a valid date string', () => {
      expect(parseDateString('2026-10-05').toISOString()).toBe('2026-10-05T00:00:00.000Z');
    });

    it.each([undefined, null, '', '31/12/2026', 'not-a-date', 12345, true])('rejects %j', (bad) => {
      expect(() => parseDateString(bad)).toThrow(BadRequestException);
    });
  });

  describe('parseExpiryInput (BUG-32)', () => {
    it.each([
      ['2026-10-05', '2026-10-05T20:59:59.999Z'], // IDT, UTC+3
      ['2026-12-10', '2026-12-10T21:59:59.999Z'], // IST, UTC+2
      ['2026-03-27', '2026-03-27T20:59:59.999Z'], // DST starts 02:00 that day; end of day is UTC+3
      ['2026-10-25', '2026-10-25T21:59:59.999Z'], // DST ends that day; end of day is UTC+2
    ])('date-only %s means end of that day in Asia/Jerusalem', (input, iso) => {
      expect(parseExpiryInput(input).toISOString()).toBe(iso);
    });

    it('takes a timestamp with a time component literally', () => {
      expect(parseExpiryInput('2026-10-05T11:00:00Z').toISOString()).toBe('2026-10-05T11:00:00.000Z');
    });

    it.each(['2026-02-31', '2026-13-01', 'tomorrow', '', 5, null])('rejects %j', (bad) => {
      expect(() => parseExpiryInput(bad)).toThrow(BadRequestException);
    });
  });
});
