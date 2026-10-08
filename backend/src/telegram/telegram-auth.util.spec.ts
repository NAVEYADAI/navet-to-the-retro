import { isTelegramAuthDateFresh } from './telegram-auth.util';

describe('isTelegramAuthDateFresh', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  const secs = (offsetMs: number) => Math.floor((now.getTime() + offsetMs) / 1000);

  it('accepts a payload signed just now', () => {
    expect(isTelegramAuthDateFresh(secs(0), now)).toBe(true);
  });

  it('accepts a payload up to 5 minutes old', () => {
    expect(isTelegramAuthDateFresh(secs(-4 * 60 * 1000), now)).toBe(true);
  });

  it('rejects a payload older than 5 minutes (BUG-50: was 24h)', () => {
    expect(isTelegramAuthDateFresh(secs(-6 * 60 * 1000), now)).toBe(false);
    expect(isTelegramAuthDateFresh(secs(-23 * 60 * 60 * 1000), now)).toBe(false);
  });

  it('tolerates small clock skew but rejects a payload dated well in the future', () => {
    expect(isTelegramAuthDateFresh(secs(30 * 1000), now)).toBe(true);
    expect(isTelegramAuthDateFresh(secs(10 * 60 * 1000), now)).toBe(false);
  });

  it('rejects non-numeric / non-finite auth_date values', () => {
    expect(isTelegramAuthDateFresh(NaN, now)).toBe(false);
    expect(isTelegramAuthDateFresh(undefined as any, now)).toBe(false);
    expect(isTelegramAuthDateFresh('1759665600' as any, now)).toBe(false);
  });
});
