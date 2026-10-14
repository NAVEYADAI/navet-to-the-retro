import { renderHook, act } from '@testing-library/react-native';
import axios from 'axios';
import { useDeletedSprints } from '../use-deleted-sprints';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const sprint = (id: number) => ({ id, name: `S${id}`, startDate: '2026-01-01', endDate: '2026-01-14', commentCount: id, daysLeft: 20 });

async function setup() {
  const onRestored = jest.fn();
  const hook = await renderHook(() => useDeletedSprints({ teamId: 4, token: 'tok', onRestored }));
  return { ...hook, onRestored };
}

afterEach(() => { jest.clearAllMocks(); mockedAxios.get.mockReset(); mockedAxios.post.mockReset(); });

describe('useDeletedSprints (feature 14)', () => {
  it('fetches nothing until the admin opens the list (not on every team card)', async () => {
    await setup();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('opening loads the deleted sprints with the token; closing hides them without another request', async () => {
    mockedAxios.get.mockResolvedValue({ data: [sprint(1), sprint(2)] });
    const { result } = await setup();

    await act(async () => { result.current.toggle(); });
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/teams/4/sprints/deleted'), { headers: { Authorization: 'Bearer tok' } });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.items).toHaveLength(2);
    expect(trackEvent).toHaveBeenCalledWith('deleted_sprints_toggled', { open: true });

    await act(async () => { result.current.toggle(); });
    expect(result.current.isOpen).toBe(false);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('a failed load shows the load error', async () => {
    mockedAxios.get.mockRejectedValue(new Error('network'));
    const { result } = await setup();
    await act(async () => { result.current.toggle(); });
    expect(result.current.error).toBe(Strings.sprintDeletion.loadError);
    expect(result.current.isLoading).toBe(false);
  });

  it('restoring POSTs, drops the row, tracks it and tells the sprint list to reload', async () => {
    mockedAxios.get.mockResolvedValue({ data: [sprint(1), sprint(2)] });
    mockedAxios.post.mockResolvedValue({ data: {} });
    const { result, onRestored } = await setup();
    await act(async () => { result.current.toggle(); });

    await act(async () => { await result.current.restore(result.current.items[0]); });

    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/teams/4/sprints/1/restore'), {}, { headers: { Authorization: 'Bearer tok' } });
    expect(result.current.items.map((s) => s.id)).toEqual([2]);
    expect(trackEvent).toHaveBeenCalledWith('sprint_restored', { sprintId: 1, commentCount: 1 });
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(result.current.restoringId).toBeNull();
  });

  it('a failed restore keeps the row, shows the server message and does not reload the list', async () => {
    mockedAxios.get.mockResolvedValue({ data: [sprint(1)] });
    mockedAxios.post.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { message: 'Sprint not found' } } }));
    const { result, onRestored } = await setup();
    await act(async () => { result.current.toggle(); });

    await act(async () => { await result.current.restore(result.current.items[0]); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBe('Sprint not found');
    expect(onRestored).not.toHaveBeenCalled();
  });
});

describe('deleted-sprint labels', () => {
  it.each([[0, 'היום האחרון לשחזור'], [1, 'יום אחד לשחזור'], [18, '18 ימים לשחזור']])('%i days left → %s', (n, text) =>
    expect(Strings.sprintDeletion.daysLeft(n)).toBe(text));
  it.each([[0, 'ללא הערות'], [1, 'הערה אחת'], [5, '5 הערות']])('%i comments → %s', (n, text) =>
    expect(Strings.sprintDeletion.commentCount(n)).toBe(text));
});
