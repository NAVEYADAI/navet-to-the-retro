import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../auth-context';

jest.mock('@/lib/analytics', () => ({ identifyUser: jest.fn(), resetAnalytics: jest.fn(), trackEvent: jest.fn() }));

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const originalAdapter = axios.defaults.adapter;

function stubBackend(respond: (url: string) => number, user: any = { id: 7, username: 'nave' }) {
  axios.defaults.adapter = (config: any) => {
    const status = respond(String(config.url));
    const response = { data: user, status, statusText: '', headers: {}, config };
    return status >= 400
      ? Promise.reject(new AxiosError(`status ${status}`, 'ERR_BAD_REQUEST', config, null, response as any))
      : Promise.resolve(response);
  };
}

// Native session persistence (BUG-30): the token must survive an app relaunch, which we simulate by
// seeding AsyncStorage before mounting a brand-new provider.
describe('AuthProvider — native session persistence (BUG-30)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });
  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
  });

  it('restores a persisted token on startup, staying in loading until /auth/me resolves', async () => {
    await AsyncStorage.setItem('userToken', 'tok-saved');
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    axios.defaults.adapter = async (config: any) => {
      if (String(config.url).endsWith('/auth/me')) await gate;
      return { data: { id: 7, username: 'nave' }, status: 200, statusText: '', headers: {}, config };
    };
    const { result } = await renderHook(() => useAuth(), { wrapper });
    // The stored token is read, but /auth/me hasn't answered: still loading, so the gate in
    // _layout.tsx keeps showing the splash instead of flashing the login screen.
    expect(result.current.loading).toBe(true);
    expect(result.current.token).toBeNull();
    await act(async () => {
      release();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBe('tok-saved');
    expect(result.current.user).toEqual({ id: 7, username: 'nave' });
  });

  it('shows logged-out state (no token) when nothing is persisted', async () => {
    stubBackend(() => 200);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBeNull();
  });

  it('persists the token on login', async () => {
    stubBackend(() => 200);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('tok-new', { id: 1 });
    });
    expect(await AsyncStorage.getItem('userToken')).toBe('tok-new');
  });

  it('clears the persisted token on logout', async () => {
    await AsyncStorage.setItem('userToken', 'tok-saved');
    stubBackend(() => 200);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.token).toBe('tok-saved'));
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.token).toBeNull();
    expect(await AsyncStorage.getItem('userToken')).toBeNull();
  });

  it('clears the persisted token when /auth/me rejects it on startup (401)', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await AsyncStorage.setItem('userToken', 'tok-expired');
    stubBackend(() => 401);
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(await AsyncStorage.getItem('userToken')).toBeNull();
  });

  it('clears the persisted token when an authenticated request returns 401 mid-session', async () => {
    stubBackend((url) => (url.includes('/teams/user/me') ? 401 : 200));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('tok-live', { id: 1 });
    });
    expect(await AsyncStorage.getItem('userToken')).toBe('tok-live');

    await act(async () => {
      await axios
        .get('http://localhost:5005/teams/user/me', { headers: { Authorization: 'Bearer tok-live' } })
        .catch(() => {});
    });
    await waitFor(() => expect(result.current.token).toBeNull());
    await waitFor(async () => expect(await AsyncStorage.getItem('userToken')).toBeNull());
  });
});
