import { israelDayAnchor } from './israel-day';
import { getSprintDayAnchor } from '../telegram/telegram-conversation.service';

describe('israelDayAnchor', () => {
  it('resolves the Asia/Jerusalem calendar day, not the UTC one', () => {
    // 22:30 UTC on Oct 5 is already 01:30 on Oct 6 in Israel (UTC+3 in DST).
    expect(israelDayAnchor(new Date('2026-10-05T22:30:00Z')).toISOString()).toBe('2026-10-06T00:00:00.000Z');
    expect(israelDayAnchor(new Date('2026-10-05T10:00:00Z')).toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('handles winter time (UTC+2) around midnight', () => {
    expect(israelDayAnchor(new Date('2026-01-10T21:59:59Z')).toISOString()).toBe('2026-01-10T00:00:00.000Z');
    expect(israelDayAnchor(new Date('2026-01-10T22:00:00Z')).toISOString()).toBe('2026-01-11T00:00:00.000Z');
  });

  it('is the very same function the Telegram bot uses (one implementation)', () => {
    expect(getSprintDayAnchor).toBe(israelDayAnchor);
  });
});
