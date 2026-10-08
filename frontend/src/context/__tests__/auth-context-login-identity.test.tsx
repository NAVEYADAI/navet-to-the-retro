import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import axios from 'axios';
import { AuthProvider, useAuth } from '../auth-context';

jest.mock('@/lib/analytics', () => ({ identifyUser: jest.fn(), resetAnalytics: jest.fn(), trackEvent: jest.fn() }));

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const originalAdapter = axios.defaults.adapter;

describe('AuthProvider — login identity (BUG-57)', () => {
  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
  });

  it('keeps the same `login` function across provider re-renders (so effects depending on it do not re-run)', async () => {
    axios.defaults.adapter = (config: any) =>
      Promise.resolve({ data: {}, status: 200, statusText: '', headers: {}, config });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const first = result.current.login;

    await act(async () => {
      await result.current.login('tok', { id: 1 });
    });
    expect(result.current.token).toBe('tok');
    expect(result.current.login).toBe(first);

    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.login).toBe(first);
  });
});
