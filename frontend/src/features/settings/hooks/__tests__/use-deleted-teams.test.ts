import { renderHook, act, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { useDeletedTeams } from '../use-deleted-teams';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { subscribeTeamsChanged } from '@/features/dashboard/teams-changed-signal';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const team = (id: number) => ({ id, name: `T${id}`, mainOffice: null, sprintCount: id, daysLeft: 12 });

afterEach(() => { jest.clearAllMocks(); mockedAxios.get.mockReset(); mockedAxios.post.mockReset(); });

describe('useDeletedTeams (feature 14)', () => {
  it('loads the deleted teams on mount with the token', async () => {
    mockedAxios.get.mockResolvedValue({ data: [team(1), team(2)] });
    const { result } = await renderHook(() => useDeletedTeams('tok'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/teams/deleted'), { headers: { Authorization: 'Bearer tok' } });
    expect(result.current.items).toHaveLength(2);
  });

  it('does not fetch without a session', async () => {
    await renderHook(() => useDeletedTeams(null));
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('a failed load shows the load error', async () => {
    mockedAxios.get.mockRejectedValue(new Error('network'));
    const { result } = await renderHook(() => useDeletedTeams('tok'));
    await waitFor(() => expect(result.current.error).toBe(Strings.deletedTeams.loadError));
  });

  it('restoring POSTs, drops the row, tracks it, and tells the dashboard to refetch its teams', async () => {
    mockedAxios.get.mockResolvedValue({ data: [team(1), team(2)] });
    mockedAxios.post.mockResolvedValue({ data: {} });
    const changed = jest.fn();
    const unsubscribe = subscribeTeamsChanged(changed);
    const { result } = await renderHook(() => useDeletedTeams('tok'));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => { await result.current.restore(result.current.items[1]); });
    unsubscribe();

    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/teams/2/restore'), {}, { headers: { Authorization: 'Bearer tok' } });
    expect(result.current.items.map((t) => t.id)).toEqual([1]);
    expect(trackEvent).toHaveBeenCalledWith('team_restored', { teamId: 2, sprintCount: 2 });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('a failed restore keeps the row and shows the server message', async () => {
    mockedAxios.get.mockResolvedValue({ data: [team(1)] });
    mockedAxios.post.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { message: 'Only team admins can restore the team' } } }));
    const { result } = await renderHook(() => useDeletedTeams('tok'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => { await result.current.restore(result.current.items[0]); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBe('Only team admins can restore the team');
  });

  it('the refresh button (load) fetches again', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    const { result } = await renderHook(() => useDeletedTeams('tok'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.load(); });
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});
