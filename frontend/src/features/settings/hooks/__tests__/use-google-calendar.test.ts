import { renderHook, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { useGoogleCalendar } from '../use-google-calendar';
import { Strings } from '@/constants/strings';

jest.mock('axios');
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useGoogleCalendar status load (BUG-34)', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('reports a status-load failure as an error, not as "not connected"', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    const { result } = await renderHook(() => useGoogleCalendar('tok'));

    await waitFor(() => expect(result.current.statusLoading).toBe(false));
    expect(result.current.statusError).toBe(true);
    expect(result.current.message).toEqual({ text: Strings.settings.googleCalendarStatusLoadError, isError: true });
  });

  it('has no error on a successful status fetch', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { connected: true, googleAccountEmail: 'a@b.com' } });
    const { result } = await renderHook(() => useGoogleCalendar('tok'));

    await waitFor(() => expect(result.current.statusLoading).toBe(false));
    expect(result.current.statusError).toBe(false);
    expect(result.current.connected).toBe(true);
    expect(result.current.message).toBeNull();
  });
});
