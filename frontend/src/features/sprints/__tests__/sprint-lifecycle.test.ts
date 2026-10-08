import {
  getSprintProgress,
  daysUntilStart,
  getSprintBucket,
  getSprintState,
  daysSinceEnd,
  RECENT_SPRINT_DAYS,
} from '../sprint-lifecycle';

const at = (iso: string) => new Date(`${iso}T12:00:00`);

describe('sprint lifecycle', () => {
  const start = '2026-09-28';
  const end = '2026-10-05';

  it('is active from the start date through the end date, inclusive', () => {
    expect(getSprintState(start, end, at('2026-09-28'))).toBe('active');
    expect(getSprintState(start, end, at('2026-10-05'))).toBe('active');
  });

  it('is upcoming before the start date', () => {
    expect(getSprintBucket(start, end, at('2026-09-27'))).toBe('upcoming');
  });

  it('stays "recent" for exactly RECENT_SPRINT_DAYS after the end date', () => {
    expect(RECENT_SPRINT_DAYS).toBe(3);
    expect(getSprintBucket(start, end, at('2026-10-06'))).toBe('recent');
    expect(getSprintBucket(start, end, at('2026-10-08'))).toBe('recent');
  });

  it('becomes expired the day after the grace period', () => {
    expect(getSprintBucket(start, end, at('2026-10-09'))).toBe('expired');
    expect(getSprintBucket(start, end, at('2026-12-01'))).toBe('expired');
  });

  it('counts days since end', () => {
    expect(daysSinceEnd(end, at('2026-10-05'))).toBe(0);
    expect(daysSinceEnd(end, at('2026-10-07'))).toBe(2);
  });

  it('is not affected by the time of day', () => {
    expect(getSprintBucket(start, end, new Date('2026-10-08T23:59:00'))).toBe('recent');
    expect(getSprintBucket(start, end, new Date('2026-10-09T00:01:00'))).toBe('expired');
  });

  it('reports which day of an active sprint today is', () => {
    // start..end = 2026-09-28..2026-10-05 → 8 days
    expect(getSprintProgress(start, end, at('2026-09-28'))).toEqual({ day: 1, total: 8, percent: 13 });
    expect(getSprintProgress(start, end, at('2026-10-05'))).toEqual({ day: 8, total: 8, percent: 100 });
  });

  it('counts days until an upcoming sprint starts', () => {
    expect(daysUntilStart(start, at('2026-09-27'))).toBe(1);
    expect(daysUntilStart(start, at('2026-09-23'))).toBe(5);
  });
});
