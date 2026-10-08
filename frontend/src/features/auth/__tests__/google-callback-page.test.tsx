import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import GoogleLoginCallbackPage from '@/app/auth/google/callback';

const mockLogin = jest.fn().mockResolvedValue(undefined);
const mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { replace: jest.fn() },
}));
jest.mock('@/context/auth-context', () => ({ useAuth: () => ({ login: mockLogin }) }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn(), identifyUser: jest.fn(), resetAnalytics: jest.fn() }));
jest.mock('@/api/config', () => ({ getBackendUrl: () => 'http://backend.test' }));
jest.mock('axios');

describe('GoogleLoginCallbackPage (BUG-21 / BUG-57)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockParams)) delete mockParams[k];
    (axios.post as jest.Mock).mockResolvedValue({ data: { accessToken: 'jwt', user: { id: 1 } } });
  });

  it('exchanges the ticket exactly once even if the page re-renders', async () => {
    mockParams.ticket = 'one-time';
    const { rerender } = await render(<GoogleLoginCallbackPage />);
    await rerender(<GoogleLoginCallbackPage />);
    await rerender(<GoogleLoginCallbackPage />);

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith('http://backend.test/auth/google/exchange', { ticket: 'one-time' });
  });

  it('does not call the exchange endpoint when there is a pendingTicket (role-picker step) or an error', async () => {
    mockParams.pendingTicket = 'pending';
    await render(<GoogleLoginCallbackPage />);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
