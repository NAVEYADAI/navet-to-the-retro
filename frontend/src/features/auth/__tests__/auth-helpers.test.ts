import { buildRegisterPayload, getAuthErrorMessage } from '../auth-helpers';
import { Strings } from '@/constants/strings';

describe('buildRegisterPayload', () => {
  it('does not derive a username from the email local-part (BUG-07)', () => {
    const a = buildRegisterPayload({ email: 'dana@a.com', password: 'p', firstName: '', lastName: '', role: 'DEVELOPER' });
    const b = buildRegisterPayload({ email: 'dana@b.com', password: 'p', firstName: '', lastName: '', role: 'DEVELOPER' });
    expect(a).not.toHaveProperty('username');
    expect(b).not.toHaveProperty('username');
    expect(a.email).not.toBe(b.email);
  });

  it('trims the email and passes the other fields through', () => {
    expect(
      buildRegisterPayload({ email: '  x@y.com ', password: 'pw', firstName: 'A', lastName: 'B', role: 'TESTER' })
    ).toEqual({ email: 'x@y.com', password: 'pw', firstName: 'A', lastName: 'B', role: 'TESTER' });
  });
});

describe('getAuthErrorMessage', () => {
  const httpError = (status: number, message?: any) => ({ response: { status, data: { message } } });

  it('maps 409 to the Hebrew email-exists message', () => {
    expect(getAuthErrorMessage(httpError(409, 'Username or email already exists'), false)).toBe(Strings.auth.emailExistsError);
  });

  it('maps a login 401 to invalid credentials', () => {
    expect(getAuthErrorMessage(httpError(401, 'Invalid credentials'), true)).toBe(Strings.auth.invalidCredentialsError);
  });

  it('passes a Hebrew server message through (e.g. Google-only account hint)', () => {
    const msg = 'חשבון זה מחובר רק דרך Google';
    expect(getAuthErrorMessage(httpError(401, msg), true)).toBe(msg);
  });

  it('reports a connection problem when there is no response', () => {
    expect(getAuthErrorMessage(new Error('Network Error'), true)).toBe(Strings.auth.networkError);
  });

  it('falls back to the generic message for other statuses', () => {
    expect(getAuthErrorMessage(httpError(500, 'Internal'), false)).toBe(Strings.auth.genericError);
    expect(getAuthErrorMessage(httpError(400, ['email must be an email']), false)).toBe(Strings.auth.genericError);
  });
});
