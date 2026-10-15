import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { QuickStartCardNative } from '../native/quick-start-card-native';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.setTimeout(30000);
jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/context/auth-context', () => ({ useAuth: () => ({ token: 'tok' }) }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const S = Strings.onboarding;
let server: { checklistDismissed: boolean; checklistComplete: boolean };

beforeEach(() => {
  server = { checklistDismissed: true, checklistComplete: false };
  mockedAxios.get.mockImplementation(() => Promise.resolve({ data: { track: 'MEMBER', steps: [], unseenFeatureKeys: [], ...server } }));
  mockedAxios.post.mockImplementation(() => { server.checklistDismissed = false; return Promise.resolve({ data: {} }); });
});
afterEach(() => jest.clearAllMocks());

describe('QuickStartCardNative', () => {
  it('"הצג שוב" restores a hidden checklist and tracks it', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(<QuickStartCardNative />);
    await waitFor(() => expect(getByText(S.quickStartDismissedText)).toBeTruthy());
    await fireEvent.press(getByTestId('quick-start-restore'));
    expect(trackEvent).toHaveBeenCalledWith('onboarding_restore_clicked', { screen: 'settings' });
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/restore-checklist'), {}, expect.anything());
    await waitFor(() => expect(getByText(S.quickStartVisibleText)).toBeTruthy());
    expect(queryByTestId('quick-start-restore')).toBeNull();
  });

  it('renders nothing when the status could not be loaded', async () => {
    mockedAxios.get.mockRejectedValue(new Error('x'));
    const { toJSON } = await render(<QuickStartCardNative />);
    expect(toJSON()).toBeNull();
  });
});
