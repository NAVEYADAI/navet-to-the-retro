import { sanitizeUrlForLog } from './logging.middleware';

describe('sanitizeUrlForLog (BUG-41)', () => {
  it('drops the query string (OAuth code/state/ticket)', () => {
    expect(sanitizeUrlForLog('/auth/google/callback?code=SECRET&state=ALSO_SECRET')).toBe('/auth/google/callback');
    expect(sanitizeUrlForLog('/google-calendar/callback?code=abc#frag')).toBe('/google-calendar/callback');
  });

  it('redacts the invite token in the public invite routes', () => {
    const token = 'a'.repeat(48);
    expect(sanitizeUrlForLog(`/invites/${token}`)).toBe('/invites/[redacted]');
    expect(sanitizeUrlForLog(`/invites/${token}/consume`)).toBe('/invites/[redacted]/consume');
    expect(sanitizeUrlForLog(`/invites/${token}/consume-phantom-conversion?x=1`)).toBe('/invites/[redacted]/consume-phantom-conversion');
    expect(sanitizeUrlForLog(`/INVITES/${token}`)).toBe('/invites/[redacted]');
  });

  it('leaves ordinary paths, including team invite management ids, untouched', () => {
    expect(sanitizeUrlForLog('/teams/5/invites/12')).toBe('/teams/5/invites/12');
    expect(sanitizeUrlForLog('/teams/5/sprints')).toBe('/teams/5/sprints');
    expect(sanitizeUrlForLog('/')).toBe('/');
  });
});
