import axios from 'axios';
import {
  getRejectedToken,
  installUnauthorizedInterceptor,
  isAuthEntryUrl,
  setUnauthorizedHandler,
} from '../unauthorized-interceptor';

const err401 = (url: string, headers: any = { Authorization: 'Bearer tok-1' }) => ({
  response: { status: 401 },
  config: { url, headers },
});

describe('isAuthEntryUrl', () => {
  it('matches login/register/google entry calls only', () => {
    expect(isAuthEntryUrl('http://x/auth/login')).toBe(true);
    expect(isAuthEntryUrl('http://x/auth/register')).toBe(true);
    expect(isAuthEntryUrl('http://x/auth/google/exchange')).toBe(true);
    expect(isAuthEntryUrl('http://x/auth/me')).toBe(false);
    expect(isAuthEntryUrl('http://x/teams/user/me')).toBe(false);
  });
});

describe('getRejectedToken', () => {
  it('returns the bearer token for an authenticated 401', () => {
    expect(getRejectedToken(err401('http://x/teams/user/me'))).toBe('tok-1');
  });

  it('reads AxiosHeaders-style .get()', () => {
    const headers = { get: (k: string) => (k === 'Authorization' ? 'Bearer tok-2' : undefined) };
    expect(getRejectedToken(err401('http://x/teams', headers))).toBe('tok-2');
  });

  it('ignores login/register 401s, non-401s and unauthenticated requests', () => {
    expect(getRejectedToken(err401('http://x/auth/login'))).toBeNull();
    expect(getRejectedToken(err401('http://x/auth/register'))).toBeNull();
    expect(getRejectedToken({ response: { status: 500 }, config: { url: '/teams', headers: { Authorization: 'Bearer t' } } })).toBeNull();
    expect(getRejectedToken(err401('http://x/teams', {}))).toBeNull();
    expect(getRejectedToken(new Error('Network Error'))).toBeNull();
  });
});

describe('installUnauthorizedInterceptor (real axios instance, stubbed adapter)', () => {
  const handler = jest.fn();

  const makeInstance = (status: number) => {
    const instance = axios.create({
      adapter: (config) =>
        status >= 400
          ? Promise.reject(Object.assign(new Error('fail'), { config, response: { status, data: {}, config } }))
          : Promise.resolve({ data: {}, status, statusText: 'OK', headers: {}, config }),
    });
    installUnauthorizedInterceptor(instance);
    return instance;
  };

  beforeEach(() => {
    handler.mockClear();
    setUnauthorizedHandler(handler);
  });
  afterAll(() => setUnauthorizedHandler(null));

  it('calls the handler with the rejected token and still rejects the request', async () => {
    const instance = makeInstance(401);
    await expect(
      instance.get('http://x/teams/user/me', { headers: { Authorization: 'Bearer tok-9' } })
    ).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledWith('tok-9');
  });

  it('does not call the handler for a failed login', async () => {
    const instance = makeInstance(401);
    await expect(instance.post('http://x/auth/login', {})).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call the handler on success or on other errors', async () => {
    await makeInstance(200).get('http://x/teams', { headers: { Authorization: 'Bearer t' } });
    await expect(
      makeInstance(500).get('http://x/teams', { headers: { Authorization: 'Bearer t' } })
    ).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });
});
