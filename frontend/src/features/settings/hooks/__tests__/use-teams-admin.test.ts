import { renderHook, act } from '@testing-library/react-native';
import axios from 'axios';
import { useTeamsAdmin } from '../use-teams-admin';
import { subscribeTeamsChanged } from '@/features/dashboard/teams-changed-signal';
import { Strings } from '@/constants/strings';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useTeamsAdmin', () => {
  afterEach(() => jest.clearAllMocks());

  it('notifies the dashboard so the new team appears without a manual refresh (BUG-29)', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 1 } });
    const listener = jest.fn();
    const unsubscribe = subscribeTeamsChanged(listener);
    const { result } = await renderHook(() => useTeamsAdmin('tok'));

    await act(async () => {
      await result.current.handleCreateTeamSubmit('Core', 'Haifa', 'a@b.com');
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(result.current.teamMessage).toEqual({ text: expect.stringContaining('Core'), isError: false });
    unsubscribe();
  });

  it('on failure throws a friendly Hebrew error and does NOT also store it as a page-level message (BUG-56)', async () => {
    mockedAxios.post.mockRejectedValueOnce(
      Object.assign(new Error('Request failed with status code 500'), { response: { status: 500, data: {} } })
    );
    const listener = jest.fn();
    const unsubscribe = subscribeTeamsChanged(listener);
    const { result } = await renderHook(() => useTeamsAdmin('tok'));

    let thrown: any;
    await act(async () => {
      try {
        await result.current.handleCreateTeamSubmit('Core', '', 'a@b.com');
      } catch (e) {
        thrown = e;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe(Strings.dashboard.teamCreateFailedError);
    expect(thrown.message).not.toMatch(/status code/);
    expect(result.current.teamMessage).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
