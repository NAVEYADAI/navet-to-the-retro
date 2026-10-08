import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { GoogleCalendarCardNative, TelegramLinkCardNative } from '../native/integration-cards-native';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

// First test in a cold jest cache pays the RN transform cost.
jest.setTimeout(30000);

const mockGoogle = jest.fn();
const mockTelegram = jest.fn();

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/context/auth-context', () => ({ useAuth: () => ({ token: 'tok' }) }));
jest.mock('../../hooks/use-google-calendar', () => ({ useGoogleCalendar: () => mockGoogle() }));
jest.mock('../../hooks/use-telegram-link', () => ({ useTelegramLink: () => mockTelegram() }));

const googleBase = { connected: false, googleAccountEmail: undefined, statusLoading: false, statusError: false, disconnectLoading: false, message: null, handleDisconnect: jest.fn() };
const telegramBase = { connected: false, statusLoading: false, unlinkLoading: false, message: null, handleUnlink: jest.fn() };

afterEach(() => jest.clearAllMocks());

describe('integration cards (native)', () => {
  it('google: not connected hands off to the browser', async () => {
    mockGoogle.mockReturnValue(googleBase);
    const { getByText } = await render(<GoogleCalendarCardNative />);
    await fireEvent.press(getByText(Strings.settings.telegramOpenInBrowserButton));
    expect(trackEvent).toHaveBeenCalledWith('google_calendar_open_in_browser_clicked');
    expect(openBrowserAsync).toHaveBeenCalledWith(expect.stringContaining('/settings'));
  });

  it('google: connected shows the account and a working disconnect button', async () => {
    mockGoogle.mockReturnValue({ ...googleBase, connected: true, googleAccountEmail: 'a@b.com' });
    const { getByText } = await render(<GoogleCalendarCardNative />);
    expect(getByText(Strings.settings.googleCalendarConnectedLabel('a@b.com'))).toBeTruthy();
    await fireEvent.press(getByText(Strings.settings.googleCalendarDisconnectButton));
    expect(googleBase.handleDisconnect).toHaveBeenCalled();
  });

  it('telegram: not connected hands off to the browser; connected can disconnect', async () => {
    mockTelegram.mockReturnValue(telegramBase);
    const first = await render(<TelegramLinkCardNative />);
    await fireEvent.press(first.getByText(Strings.settings.telegramOpenInBrowserButton));
    expect(trackEvent).toHaveBeenCalledWith('telegram_open_in_browser_clicked');
    await first.unmount();

    mockTelegram.mockReturnValue({ ...telegramBase, connected: true });
    const second = await render(<TelegramLinkCardNative />);
    await fireEvent.press(second.getByText(Strings.settings.telegramDisconnectButton));
    expect(telegramBase.handleUnlink).toHaveBeenCalled();
  });
});
