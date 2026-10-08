import { formatDate, formatTime, formatDateRange } from '../format-date';

describe('format-date (BUG-58: one he-IL formatter)', () => {
  const sample = new Date(2026, 8, 28, 14, 5); // 28 Sep 2026 14:05 local

  it('formats dates in he-IL (day.month.year), never the US month/day/year', () => {
    expect(formatDate(sample)).toBe(sample.toLocaleDateString('he-IL'));
    expect(formatDate(sample)).toBe('28.9.2026');
    expect(formatDate(sample)).not.toContain('/');
  });

  it('accepts ISO strings', () => {
    expect(formatDate('2026-09-28T12:00:00.000Z')).toBe('28.9.2026');
  });

  it('formats times as 2-digit hour:minute in he-IL', () => {
    expect(formatTime(sample)).toBe(sample.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
  });

  it('formats a range with " - " between he-IL dates', () => {
    expect(formatDateRange(sample, new Date(2026, 9, 12))).toBe('28.9.2026 - 12.10.2026');
  });
});
