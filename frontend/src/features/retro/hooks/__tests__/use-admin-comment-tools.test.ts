import { renderHook, act, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { useDeletedComments } from '../use-deleted-comments';
import { useWriteExtensions, todayLocalIso } from '../use-write-extensions';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
const auth = { headers: { Authorization: 'Bearer tok' } };
const serverError = (message: string) => Object.assign(new Error('boom'), { response: { data: { message } } });

afterEach(() => { jest.clearAllMocks(); mockedAxios.get.mockReset(); mockedAxios.post.mockReset(); mockedAxios.delete.mockReset(); });

describe('useDeletedComments (feature 13, admin panel)', () => {
  const deletedItem = { id: 1, content: 'x', type: 'KEEP', isAnonymous: true, deletedAt: '2026-10-20T10:00:00.000Z', deletedBy: null, deletedByAuthor: true };

  it('fetches nothing until the panel is opened, then once; opening is tracked', async () => {
    mockedAxios.get.mockResolvedValue({ data: [deletedItem] });
    const { result } = await renderHook(() => useDeletedComments(5, 'tok'));
    expect(mockedAxios.get).not.toHaveBeenCalled();

    await act(async () => { result.current.toggle(); });
    await waitFor(() => expect(result.current.items).toEqual([deletedItem]));
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/comments/deleted'), auth);
    expect(trackEvent).toHaveBeenCalledWith('deleted_comments_panel_opened', { sprintId: 5 });

    await act(async () => { result.current.toggle(); });
    expect(result.current.isOpen).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('deleted_comments_panel_closed', { sprintId: 5 });
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('a bumped refreshKey refetches an open panel; the explicit refresh button refetches and is tracked', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    const { result, rerender } = await renderHook((key: number) => useDeletedComments(5, 'tok', key), { initialProps: 0 });
    await act(async () => { result.current.toggle(); });
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(1));
    await rerender(1);
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
    await act(async () => { await result.current.refresh(); });
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    expect(trackEvent).toHaveBeenCalledWith('refresh_clicked', { screen: 'deleted_comments_panel' });
  });

  it('shows the server\'s error (e.g. not an admin) instead of an empty list', async () => {
    mockedAxios.get.mockRejectedValue(serverError('רק מנהל צוות יכול לראות הערות שנמחקו'));
    const { result } = await renderHook(() => useDeletedComments(5, 'tok'));
    await act(async () => { result.current.toggle(); });
    await waitFor(() => expect(result.current.error).toBe('רק מנהל צוות יכול לראות הערות שנמחקו'));
    expect(result.current.items).toEqual([]);
  });
});

describe('useWriteExtensions (feature 13, admin panel)', () => {
  const ext = { id: 3, sprintId: 5, userId: 21, expiresAt: '2026-10-30T20:59:59.999Z', user: { id: 21, username: 'dana' } };
  const future = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return todayLocalIso(d);
  };

  it('lists the active extensions when opened', async () => {
    mockedAxios.get.mockResolvedValue({ data: [ext] });
    const { result } = await renderHook(() => useWriteExtensions(5, 'tok'));
    await act(async () => { result.current.toggle(); });
    await waitFor(() => expect(result.current.items).toEqual([ext]));
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-extensions'), auth);
    expect(trackEvent).toHaveBeenCalledWith('write_extensions_panel_opened', { sprintId: 5 });
  });

  it('validates before calling the server: member, date format, not in the past', async () => {
    const { result } = await renderHook(() => useWriteExtensions(5, 'tok'));
    await act(async () => { await result.current.grant('', future()); });
    expect(result.current.grantError).toBe(Strings.retroBoard.extensionsPickMemberError);
    await act(async () => { await result.current.grant('21', ''); });
    expect(result.current.grantError).toBe(Strings.retroBoard.extensionsPickDateError);
    await act(async () => { await result.current.grant('21', '30/10/2026'); });
    expect(result.current.grantError).toBe(Strings.retroBoard.extensionsBadDateError);
    await act(async () => { await result.current.grant('21', '2020-01-01'); });
    expect(result.current.grantError).toBe(Strings.retroBoard.extensionsPastDateError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('granting POSTs { userId, expiresAt }, tracks it, reloads the list and tells the board', async () => {
    mockedAxios.post.mockResolvedValue({ data: ext });
    mockedAxios.get.mockResolvedValue({ data: [ext] });
    const onChanged = jest.fn();
    const { result } = await renderHook(() => useWriteExtensions(5, 'tok', onChanged));
    const date = future();
    let ok = false;
    await act(async () => { ok = await result.current.grant('21', date); });
    expect(ok).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-extensions'), { userId: 21, expiresAt: date }, auth);
    expect(trackEvent).toHaveBeenCalledWith('write_extension_granted', { sprintId: 5 });
    expect(result.current.items).toEqual([ext]);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('today is a valid end date (the server treats it as the end of that day)', async () => {
    mockedAxios.post.mockResolvedValue({ data: ext });
    mockedAxios.get.mockResolvedValue({ data: [] });
    const { result } = await renderHook(() => useWriteExtensions(5, 'tok'));
    await act(async () => { await result.current.grant('21', todayLocalIso()); });
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('a rejected grant shows the server\'s message and keeps the form (returns false)', async () => {
    mockedAxios.post.mockRejectedValue(serverError('Team member not found in this team'));
    const { result } = await renderHook(() => useWriteExtensions(5, 'tok'));
    let ok = true;
    await act(async () => { ok = await result.current.grant('21', future()); });
    expect(ok).toBe(false);
    expect(result.current.grantError).toBe('Team member not found in this team');
    expect(result.current.error).toBeNull(); // the list-level error slot stays free for load / revoke problems
    expect(trackEvent).toHaveBeenCalledWith('write_extension_grant_failed', { sprintId: 5, status: 0 });
  });

  it('revoking DELETEs the extension, removes it from the list, tracks it and tells the board', async () => {
    mockedAxios.get.mockResolvedValue({ data: [ext] });
    mockedAxios.delete.mockResolvedValue({ data: { success: true } });
    const onChanged = jest.fn();
    const { result } = await renderHook(() => useWriteExtensions(5, 'tok', onChanged));
    await act(async () => { result.current.toggle(); });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.revoke(3); });
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-extensions/3'), auth);
    expect(result.current.items).toEqual([]);
    expect(trackEvent).toHaveBeenCalledWith('write_extension_revoked', { sprintId: 5 });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('a failed revoke keeps the row, shows the list-level error and is tracked', async () => {
    mockedAxios.get.mockResolvedValue({ data: [ext] });
    mockedAxios.delete.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500, data: {} } }));
    const { result } = await renderHook(() => useWriteExtensions(5, 'tok'));
    await act(async () => { result.current.toggle(); });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.revoke(3); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBe(Strings.retroBoard.extensionsRevokeError);
    expect(trackEvent).toHaveBeenCalledWith('write_extension_revoke_failed', { sprintId: 5, status: 500 });
  });

  it('closing the panel is tracked too', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    const { result } = await renderHook(() => useWriteExtensions(5, 'tok'));
    await act(async () => { result.current.toggle(); });
    await act(async () => { result.current.toggle(); });
    expect(trackEvent).toHaveBeenCalledWith('write_extensions_panel_closed', { sprintId: 5 });
  });
});
