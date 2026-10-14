import { renderHook, act } from '@testing-library/react-native';
import axios from 'axios';
import { useDeleteSprint } from '../use-delete-sprint';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const serverError = (message: string) => Object.assign(new Error('boom'), { response: { data: { message } } });

async function setup(commentCount = 3) {
  const onDeleted = jest.fn();
  const hook = await renderHook(() => useDeleteSprint({ teamId: 4, sprintId: 9, token: 'tok', commentCount, onDeleted }));
  return { ...hook, onDeleted };
}

afterEach(() => { jest.clearAllMocks(); mockedAxios.delete.mockReset(); });

describe('useDeleteSprint (feature 14)', () => {
  it('asking only opens the confirmation — nothing is deleted yet', async () => {
    const { result } = await setup();
    await act(async () => { result.current.ask(); });
    expect(result.current.isConfirming).toBe(true);
    expect(mockedAxios.delete).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('sprint_delete_clicked', { sprintId: 9, commentCount: 3 });
  });

  it('confirming sends the DELETE with the token, tracks it, closes and tells the board', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { id: 9 } });
    const { result, onDeleted } = await setup();
    await act(async () => { result.current.ask(); });
    await act(async () => { await result.current.confirm(); });

    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/teams/4/sprints/9'), { headers: { Authorization: 'Bearer tok' } });
    expect(trackEvent).toHaveBeenCalledWith('sprint_deleted', { sprintId: 9, commentCount: 3 });
    expect(result.current.isConfirming).toBe(false);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('cancelling closes the confirmation, tracks it, and never calls the server', async () => {
    const { result, onDeleted } = await setup();
    await act(async () => { result.current.ask(); });
    await act(async () => { result.current.cancel(); });
    expect(result.current.isConfirming).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('sprint_delete_cancelled', { sprintId: 9 });
    expect(mockedAxios.delete).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('a server rejection keeps the confirmation open with the server message and does not navigate away', async () => {
    mockedAxios.delete.mockRejectedValue(serverError('Only team admins can delete sprints'));
    const { result, onDeleted } = await setup();
    await act(async () => { result.current.ask(); });
    await act(async () => { await result.current.confirm(); });

    expect(result.current.isConfirming).toBe(true);
    expect(result.current.error).toBe('Only team admins can delete sprints');
    expect(result.current.isDeleting).toBe(false);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('a failure without a server message falls back to the generic one, and asking again clears it', async () => {
    mockedAxios.delete.mockRejectedValue(new Error('network'));
    const { result } = await setup();
    await act(async () => { result.current.ask(); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.error).toBe(Strings.sprintDeletion.deleteError);

    await act(async () => { result.current.cancel(); });
    await act(async () => { result.current.ask(); });
    expect(result.current.error).toBeNull();
  });
});

describe('Strings.sprintDeletion.warning', () => {
  it.each([[0, 'לספרינט אין עדיין הערות.'], [1, 'הערה אחת תימחק יחד איתו.'], [7, '7 הערות יימחקו יחד איתו.']])(
    '%i comments → %s',
    (n, text) => expect(Strings.sprintDeletion.warning(n)).toBe(text)
  );
});
