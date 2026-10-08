import { getTeamCreateErrorMessage } from '../team-create-error';
import { Strings } from '@/constants/strings';

describe('getTeamCreateErrorMessage (BUG-56)', () => {
  it('shows a Hebrew server message as-is', () => {
    const err = { message: 'Request failed with status code 403', response: { status: 403, data: { message: 'רק כתובות אימייל מורשות יכולות לאשר יצירת צוות.' } } };
    expect(getTeamCreateErrorMessage(err)).toBe('רק כתובות אימייל מורשות יכולות לאשר יצירת צוות.');
  });

  it('never leaks raw axios text', () => {
    const err = { message: 'Request failed with status code 500', response: { status: 500, data: {} } };
    expect(getTeamCreateErrorMessage(err)).toBe(Strings.dashboard.teamCreateFailedError);
  });

  it('replaces an English/validation message with the generic Hebrew one', () => {
    const err = { response: { status: 400, data: { message: ['name must be a string'] } } };
    expect(getTeamCreateErrorMessage(err)).toBe(Strings.dashboard.teamCreateFailedError);
  });

  it('uses the first Hebrew entry of a message array', () => {
    const err = { response: { status: 400, data: { message: ['name must be a string', 'שם הצוות הוא שדה חובה'] } } };
    expect(getTeamCreateErrorMessage(err)).toBe('שם הצוות הוא שדה חובה');
  });

  it('maps a missing response (network error) to the connectivity message', () => {
    expect(getTeamCreateErrorMessage(new Error('Network Error'))).toBe(Strings.dashboard.teamCreateNetworkError);
  });
});
