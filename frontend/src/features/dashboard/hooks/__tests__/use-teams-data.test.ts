import { renderHook, waitFor, act } from '@testing-library/react-native';
import axios from 'axios';
import { useTeamsData } from '../use-teams-data';
import { Strings } from '@/constants/strings';
import { notifyTeamsChanged } from '../../teams-changed-signal';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useTeamsData', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('loads teams with no error', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'A' }] });
    const { result } = await renderHook(() => useTeamsData('tok'));

    await waitFor(() => expect(result.current.isLoadingTeams).toBe(false));
    expect(result.current.teams).toEqual([{ id: 1, name: 'A' }]);
    expect(result.current.loadError).toBeNull();
  });

  it('exposes a Hebrew loadError (not an empty-team state) when the fetch fails (BUG-08/34)', async () => {
    mockedAxios.get.mockRejectedValueOnce(Object.assign(new Error('401'), { response: { status: 401 } }));
    const { result } = await renderHook(() => useTeamsData('tok'));

    await waitFor(() => expect(result.current.isLoadingTeams).toBe(false));
    expect(result.current.loadError).toBe(Strings.dashboard.teamsLoadError);
  });

  it('clears the error on a successful refresh', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 2, name: 'B' }] });
    const { result } = await renderHook(() => useTeamsData('tok'));
    await waitFor(() => expect(result.current.loadError).toBe(Strings.dashboard.teamsLoadError));

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.loadError).toBeNull());
    expect(result.current.teams).toEqual([{ id: 2, name: 'B' }]);
  });
  it('keeps the list and never flips isLoadingTeams on a later refresh (BUG-28)', async () => {
    let resolveSecond!: (v: any) => void;
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'A' }] });
    mockedAxios.get.mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }) as any);
    const { result } = await renderHook(() => useTeamsData('tok'));
    await waitFor(() => expect(result.current.isLoadingTeams).toBe(false));

    await act(async () => {
      result.current.refresh();
    });
    // Mid-refresh: spinner flag stays off (so the screen keeps <TeamList> mounted), refreshing is on.
    expect(result.current.isLoadingTeams).toBe(false);
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.teams).toEqual([{ id: 1, name: 'A' }]);

    await act(async () => {
      resolveSecond({ data: [{ id: 1, name: 'A2' }] });
    });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.isLoadingTeams).toBe(false);
    expect(result.current.teams).toEqual([{ id: 1, name: 'A2' }]);
  });

  it('keeps the existing teams (and shows the error) when a background refresh fails', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'A' }] });
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    const { result } = await renderHook(() => useTeamsData('tok'));
    await waitFor(() => expect(result.current.isLoadingTeams).toBe(false));

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.loadError).toBe(Strings.dashboard.teamsLoadError));
    expect(result.current.teams).toEqual([{ id: 1, name: 'A' }]);
    expect(result.current.isLoadingTeams).toBe(false);
  });

  it('refetches in the background when another screen reports a team was created (BUG-29)', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 9, name: 'New' }] });
    const { result } = await renderHook(() => useTeamsData('tok'));
    await waitFor(() => expect(result.current.isLoadingTeams).toBe(false));

    await act(async () => {
      notifyTeamsChanged();
    });
    await waitFor(() => expect(result.current.teams).toEqual([{ id: 9, name: 'New' }]));
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(result.current.isLoadingTeams).toBe(false);
  });
});
