import { validateSprintDateRange, validateSprintDates, getSprintApiErrorMessage } from '../sprint-validation';
import { Strings } from '@/constants/strings';

describe('validateSprintDateRange (BUG-12 frontend part)', () => {
  it('rejects an end date before the start date with the Hebrew message', () => {
    expect(validateSprintDateRange('2026-10-10', '2026-10-09')).toBe(Strings.sprints.endBeforeStartError);
  });

  it('accepts end after start', () => {
    expect(validateSprintDateRange('2026-10-01', '2026-10-14')).toBeNull();
  });

  it('accepts a one-day sprint (end equals start)', () => {
    expect(validateSprintDateRange('2026-10-01', '2026-10-01')).toBeNull();
  });

  it('works across month and year boundaries', () => {
    expect(validateSprintDateRange('2026-12-31', '2027-01-01')).toBeNull();
    expect(validateSprintDateRange('2027-01-01', '2026-12-31')).toBe(Strings.sprints.endBeforeStartError);
  });

  it('does not judge empty or unparseable values (required-field / server checks own those)', () => {
    expect(validateSprintDateRange('', '2026-10-01')).toBeNull();
    expect(validateSprintDateRange('2026-10-01', '  ')).toBeNull();
    expect(validateSprintDateRange('not-a-date', 'also-not')).toBeNull();
  });

  it('falls back to Date parsing for non YYYY-MM-DD input (ISO timestamps)', () => {
    expect(validateSprintDateRange('2026-10-10T00:00:00.000Z', '2026-10-09T00:00:00.000Z')).toBe(
      Strings.sprints.endBeforeStartError
    );
  });
});

describe('validateSprintDates (BUG-15 create form)', () => {
  it('rejects unparseable dates with the invalid-date message', () => {
    expect(validateSprintDates('not-a-date', '2026-10-01')).toBe(Strings.sprints.invalidDateError);
    expect(validateSprintDates('2026-10-01', '2026-13-45')).toBe(Strings.sprints.invalidDateError);
  });

  it('delegates to the range check for valid dates', () => {
    expect(validateSprintDates('2026-10-10', '2026-10-09')).toBe(Strings.sprints.endBeforeStartError);
    expect(validateSprintDates('2026-10-01', '2026-10-09')).toBeNull();
  });
});

describe('getSprintApiErrorMessage (BUG-15)', () => {
  it('returns a string server message as-is', () => {
    expect(getSprintApiErrorMessage({ response: { data: { message: 'תאריך לא תקין' } } }, 'fb')).toBe('תאריך לא תקין');
  });

  it('joins an array of server messages into one line', () => {
    expect(getSprintApiErrorMessage({ response: { data: { message: ['א', 'ב'] } } }, 'fb')).toBe('א ב');
  });

  it('falls back to the transport message, then the fallback', () => {
    expect(getSprintApiErrorMessage({ message: 'Network Error' }, 'fb')).toBe('Network Error');
    expect(getSprintApiErrorMessage({ response: { data: {} } }, 'fb')).toBe('fb');
    expect(getSprintApiErrorMessage(undefined, 'fb')).toBe('fb');
  });
});
