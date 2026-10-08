import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import axios from 'axios';
import { AuthProvider, useAuth } from '../auth-context';

jest.mock('@/lib/analytics', () => ({ identifyUser: jest.fn(), resetAnalytics: jest.fn(), trackEvent: jest.fn() }));

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const originalAdapter = axios.defaults.adapter;

function stubBackend(respond: (url: string) => number) {
  axios.defaults.adapter = (config: any) => {
    const status = respond(String(config.url));
    const response = { data: {}, status, statusText: '', headers: {}, config };
    return status >= 400
      ? Promise.reject(Object.assign(new Error(`status ${status}`), { config, response }))
      : Promise.resolve(response);
  };
}

// The provider's in-memory storage (non-web) is module-level and would otherwise leak a saved
// token into the next test's session-restore, so every test ends with an explicit logout.
let current: ReturnType<typeof useAuth> | null = null;

describe('AuthProvider — expired-session handling (BUG-08)', () => {
  afterEach(async () => {
    await act(async () => {
      await current?.logout();
    });
    current = null;
    axios.defaults.adapter = originalAdapter;
  });

  it('clears the session when an authenticated request returns 401', async () => {
    stubBackend((url) => (url.includes('/teams/user/me') ? 401 : 200));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    current = result.current;
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('tok-live', { id: 1 });
    });
    expect(result.current.token).toBe('tok-live');

    await act(async () => {
      await axios
        .get('http://localhost:5005/teams/user/me', { headers: { Authorization: 'Bearer tok-live' } })
        .catch(() => {});
    });
    await waitFor(() => expect(result.current.token).toBeNull());
    expect(result.current.user).toBeNull();
  });

  it('keeps the session when a login/register call returns 401', async () => {
    stubBackend(() => 401);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    current = result.current;
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('tok-live', { id: 1 });
    });

    await act(async () => {
      await axios
        .post('http://localhost:5005/auth/login', {}, { headers: { Authorization: 'Bearer tok-live' } })
        .catch(() => {});
    });
    expect(result.current.token).toBe('tok-live');
  });

  it('ignores a 401 for a stale token after the user signed in again', async () => {
    stubBackend(() => 401);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    current = result.current;
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('tok-new', { id: 1 });
    });

    await act(async () => {
      await axios
        .get('http://localhost:5005/teams/user/me', { headers: { Authorization: 'Bearer tok-old' } })
        .catch(() => {});
    });
    expect(result.current.token).toBe('tok-new');
  });
});
