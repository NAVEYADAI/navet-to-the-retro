import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsScreenNative } from '../settings-screen-native';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

// First test in a cold jest cache pays the RN transform cost.
jest.setTimeout(30000);

const mockLogout = jest.fn(() => Promise.resolve());
const mockLogin = jest.fn();
const mockSetPrefs = jest.fn();

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    token: 'tok',
    user: { id: 1, username: 'me', firstName: 'דנה', lastName: 'לוי', email: 'dana@example.com' },
    login: mockLogin,
    logout: mockLogout,
  }),
}));
jest.mock('@/design/theme-context', () => {
  const actual = jest.requireActual('@/design/theme-context');
  return {
    ...actual,
    usePreferences: () => ({ prefs: { mode: 'system', scheme: 'blue', density: 'regular' }, setPrefs: mockSetPrefs }),
  };
});
// Integrations/hooks that hit the network or router have their own tests; here we test the screen shell.
jest.mock('../native/integration-cards-native', () => ({
  GoogleCalendarCardNative: () => null,
  TelegramLinkCardNative: () => null,
}));
jest.mock('@/features/teams', () => ({ CreateTeamForm: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

afterEach(() => jest.clearAllMocks());

describe('SettingsScreenNative (BUG-09)', () => {
  it('renders the settings sections on native without any web (MUI) dependency', async () => {
    const { getByText, getByDisplayValue } = await render(<SettingsScreenNative />);
    expect(getByText(Strings.settings.pageTitle)).toBeTruthy();
    expect(getByText(Strings.settings.profileCardTitle)).toBeTruthy();
    expect(getByText(Strings.settings.appearanceCardTitle)).toBeTruthy();
    expect(getByText(Strings.settings.createTeamSectionTitle)).toBeTruthy();
    expect(getByDisplayValue('dana@example.com')).toBeTruthy();
  });

  it('has a logout button that logs out and is tracked', async () => {
    const { getByTestId, getByText } = await render(<SettingsScreenNative />);
    expect(getByText(Strings.settings.logoutButton)).toBeTruthy();
    await fireEvent.press(getByTestId('settings-logout-button'));
    expect(trackEvent).toHaveBeenCalledWith('logout_clicked', { source: 'settings_native' });
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('appearance controls update preferences and are tracked', async () => {
    const { getByText } = await render(<SettingsScreenNative />);
    await fireEvent.press(getByText(Strings.settings.modeDark));
    expect(mockSetPrefs).toHaveBeenCalledWith({ mode: 'dark' });
    expect(trackEvent).toHaveBeenCalledWith('appearance_mode_changed', { mode: 'dark' });

    await fireEvent.press(getByText(Strings.settings.schemeNames.rose));
    expect(mockSetPrefs).toHaveBeenCalledWith({ scheme: 'rose' });

    await fireEvent.press(getByText(Strings.settings.densityCompact));
    expect(mockSetPrefs).toHaveBeenCalledWith({ density: 'compact' });
  });

  it('saves the profile through the tracked save button', async () => {
    const axios = require('axios');
    axios.patch.mockResolvedValueOnce({ data: { id: 1, firstName: 'דנה', lastName: 'לוי', email: 'dana@example.com' } });
    const { getByText } = await render(<SettingsScreenNative />);
    await fireEvent.press(getByText(Strings.settings.saveProfileButton));
    expect(trackEvent).toHaveBeenCalledWith('settings_profile_save_clicked');
    expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining('/auth/profile'), expect.objectContaining({ email: 'dana@example.com' }), expect.anything());
  });
});
