import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import InvitePage from '@/app/invite/[token]';
import { Strings } from '@/constants/strings';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: any[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({ token: 'bad-token' }),
}));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ token: null, login: jest.fn() }),
}));
jest.mock('@/components/auth-form', () => ({ AuthForm: () => null }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InvitePage — invalid invite (BUG-58)', () => {
  afterEach(() => jest.clearAllMocks());

  it('offers a back-to-app button that navigates home instead of a dead end', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { valid: false, reason: 'ההזמנה פגה' } });
    const { findByText, getByText } = await render(<InvitePage />);

    expect(await findByText(Strings.invites.invalidInviteTitle)).toBeTruthy();
    expect(getByText('ההזמנה פגה')).toBeTruthy();

    await fireEvent.press(getByText(Strings.invites.backToAppButton));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
