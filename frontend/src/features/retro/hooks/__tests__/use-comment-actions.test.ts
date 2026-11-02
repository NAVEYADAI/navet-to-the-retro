import { renderHook, act } from '@testing-library/react-native';
import axios from 'axios';
import { useCommentActions } from '../use-comment-actions';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const serverError = (message: string) => Object.assign(new Error('boom'), { response: { data: { message } } });
const comment = (over: Record<string, unknown> = {}) => ({
  id: 7, content: 'x', type: 'KEEP', isAnonymous: false, author: { username: 'u' }, createdAt: '2026-10-13T10:00:00.000Z', isMine: true, ...over,
}) as any;

async function setup() {
  const onUpdated = jest.fn();
  const onDeleted = jest.fn();
  const hook = await renderHook(() => useCommentActions({ token: 'tok', onUpdated, onDeleted }));
  return { ...hook, onUpdated, onDeleted };
}

afterEach(() => { jest.clearAllMocks(); mockedAxios.patch.mockReset(); mockedAxios.delete.mockReset(); });

describe('useCommentActions — edit (feature 13)', () => {
  it('starting an edit tracks it and closes any open delete confirmation', async () => {
    const { result } = await setup();
    await act(async () => { result.current.askDelete(comment({ id: 9 })); });
    await act(async () => { result.current.startEdit(comment()); });
    expect(result.current.editingId).toBe(7);
    expect(result.current.deletingId).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('comment_edit_opened', { type: 'KEEP' });
  });

  it('saving PATCHes only the given fields with the token, tracks it, hands the server copy to the board and closes', async () => {
    const updated = comment({ content: 'new', updatedAt: '2026-10-14T08:00:00.000Z' });
    mockedAxios.patch.mockResolvedValue({ data: updated });
    const { result, onUpdated } = await setup();
    await act(async () => { result.current.startEdit(comment()); });
    let ok = false;
    await act(async () => { ok = await result.current.saveEdit(comment(), { content: 'new' }); });

    expect(ok).toBe(true);
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/comments/7'), { content: 'new' }, { headers: { Authorization: 'Bearer tok' } });
    expect(trackEvent).toHaveBeenCalledWith('comment_edited', { contentChanged: true, columnChanged: false, categoryChanged: false });
    expect(onUpdated).toHaveBeenCalledWith(updated);
    expect(result.current.editingId).toBeNull();
  });

  it('an empty patch closes the form without calling the server', async () => {
    const { result } = await setup();
    await act(async () => { result.current.startEdit(comment()); });
    await act(async () => { await result.current.saveEdit(comment(), {}); });
    expect(mockedAxios.patch).not.toHaveBeenCalled();
    expect(result.current.editingId).toBeNull();
  });

  it('a rejected save keeps the form open and keeps the server\'s message for that comment (e.g. the board locked meanwhile)', async () => {
    mockedAxios.patch.mockRejectedValue(serverError('הלוח נעול לכתיבה — הספרינט הסתיים'));
    const { result, onUpdated } = await setup();
    await act(async () => { result.current.startEdit(comment()); });
    let ok = true;
    await act(async () => { ok = await result.current.saveEdit(comment(), { type: 'IMPROVE' }); });
    expect(ok).toBe(false);
    expect(result.current.editingId).toBe(7);
    expect(result.current.error).toEqual({ id: 7, message: 'הלוח נעול לכתיבה — הספרינט הסתיים' });
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('falls back to the generic message when the server sends none; cancelling clears it', async () => {
    mockedAxios.patch.mockRejectedValue(new Error('Network Error'));
    const { result } = await setup();
    await act(async () => { result.current.startEdit(comment()); });
    await act(async () => { await result.current.saveEdit(comment(), { content: 'y' }); });
    expect(result.current.error?.message).toBe(Strings.retroBoard.editError);
    await act(async () => { result.current.cancelEdit(); });
    expect(result.current.error).toBeNull();
    expect(result.current.editingId).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('comment_edit_cancelled');
  });
});

describe('useCommentActions — delete (feature 13)', () => {
  it('asking only opens the inline confirmation; nothing is deleted yet', async () => {
    const { result } = await setup();
    await act(async () => { result.current.askDelete(comment()); });
    expect(result.current.deletingId).toBe(7);
    expect(mockedAxios.delete).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('comment_delete_clicked', { moderation: false });
  });

  it('confirming DELETEs with the token, tracks it and tells the board', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { id: 7 } });
    const { result, onDeleted } = await setup();
    await act(async () => { result.current.askDelete(comment()); });
    await act(async () => { await result.current.confirmDelete(comment()); });
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/comments/7'), { headers: { Authorization: 'Bearer tok' } });
    expect(trackEvent).toHaveBeenCalledWith('comment_deleted', { moderation: false });
    expect(onDeleted).toHaveBeenCalledWith(7);
    expect(result.current.deletingId).toBeNull();
  });

  it('an admin deleting someone else\'s comment is tracked as moderation', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { id: 7 } });
    const { result } = await setup();
    const other = comment({ isMine: false });
    await act(async () => { result.current.askDelete(other); });
    await act(async () => { await result.current.confirmDelete(other); });
    expect(trackEvent).toHaveBeenCalledWith('comment_delete_clicked', { moderation: true });
    expect(trackEvent).toHaveBeenCalledWith('comment_deleted', { moderation: true });
  });

  it('a failed delete keeps the confirmation open with the message; cancel closes it without a request', async () => {
    mockedAxios.delete.mockRejectedValue(serverError('אפשר למחוק רק הערה שכתבת'));
    const { result, onDeleted } = await setup();
    await act(async () => { result.current.askDelete(comment()); });
    await act(async () => { await result.current.confirmDelete(comment()); });
    expect(result.current.deletingId).toBe(7);
    expect(result.current.error).toEqual({ id: 7, message: 'אפשר למחוק רק הערה שכתבת' });
    expect(onDeleted).not.toHaveBeenCalled();

    await act(async () => { result.current.cancelDelete(); });
    expect(result.current.deletingId).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('comment_delete_cancelled');
    expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
  });
});
