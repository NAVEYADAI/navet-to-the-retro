import { renderHook, act, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { useWriteAccess } from '../use-write-access';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const access = { canWrite: true, windowOpen: false, windowDays: 3, extensionExpiresAt: '2026-10-30T20:59:59.999Z' };

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); mockedAxios.get.mockReset(); });

describe('useWriteAccess (feature 13)', () => {
  it('reads GET /sprints/:id/write-access once on mount with the token — and again only on an explicit refresh', async () => {
    mockedAxios.get.mockResolvedValue({ data: access });
    const { result } = await renderHook(() => useWriteAccess(5, 'tok'));
    await waitFor(() => expect(result.current.access).toEqual(access));
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-access'), { headers: { Authorization: 'Bearer tok' } });

    mockedAxios.get.mockResolvedValue({ data: { ...access, canWrite: false, extensionExpiresAt: null } });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.canWrite).toBe(false);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('isLoading is true until the first response settles, and stays false on later refreshes', async () => {
    let resolve!: (v: any) => void;
    mockedAxios.get.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { result } = await renderHook(() => useWriteAccess(5, 'tok'));
    expect(result.current.isLoading).toBe(true);
    await act(async () => { resolve({ data: access }); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveAgain!: (v: any) => void;
    mockedAxios.get.mockReturnValueOnce(new Promise((r) => { resolveAgain = r; }));
    let refreshing!: Promise<void>;
    await act(async () => { refreshing = result.current.refresh(); });
    expect(result.current.isLoading).toBe(false); // a refresh does not hide the form again
    await act(async () => { resolveAgain({ data: access }); await refreshing; });
  });

  it('a failed first call also ends the loading state, fail-open (not "still loading")', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network Error'));
    const { result } = await renderHook(() => useWriteAccess(6, 'tok'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canWrite).toBe(true);
  });

  it.each([
    ['false from the server (locked board kept open by an extension)', { ...access, anonymousAllowed: false }, false],
    ['true from the server', { ...access, anonymousAllowed: true }, true],
    ['absent (older server)', access, true],
  ])('anonymousAllowed: %s', async (_label, data, expected) => {
    mockedAxios.get.mockResolvedValue({ data });
    const { result } = await renderHook(() => useWriteAccess(5, 'tok'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.anonymousAllowed).toBe(expected);
  });

  it('anonymousAllowed stays true when the call fails (the server decides)', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network Error'));
    const { result } = await renderHook(() => useWriteAccess(5, 'tok'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.anonymousAllowed).toBe(true);
  });

  it('a locked board reports canWrite false', async () => {
    mockedAxios.get.mockResolvedValue({ data: { canWrite: false, windowOpen: false, windowDays: 3, extensionExpiresAt: null } });
    const { result } = await renderHook(() => useWriteAccess(5, 'tok'));
    await waitFor(() => expect(result.current.canWrite).toBe(false));
  });

  it('when the call fails the form stays available (the server\'s 403 is the safety net)', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network Error'));
    const { result } = await renderHook(() => useWriteAccess(5, 'tok'));
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(result.current.access).toBeNull();
    expect(result.current.canWrite).toBe(true);
  });

  it('ignores a response that is not the write-access shape', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    const { result } = await renderHook(() => useWriteAccess(5, 'tok'));
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(result.current.access).toBeNull();
    expect(result.current.canWrite).toBe(true);
  });
});
