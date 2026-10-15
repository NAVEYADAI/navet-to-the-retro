import { renderHook, act, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { useOnboarding } from '../hooks/use-onboarding';
import { useQuickStart } from '../hooks/use-quick-start';
import { subscribeOnboardingChanged } from '../onboarding-changed-signal';
import { trackEvent } from '@/lib/analytics';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockPush = jest.fn();
const mockOpenFocusPoints = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/sprint-routes', () => ({ openFocusPoints: (...a: unknown[]) => mockOpenFocusPoints(...a) }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mgmt = (o: object = {}) => ({
  track: 'MANAGEMENT',
  steps: [
    { key: 'create-team', done: true, optional: false },
    { key: 'invite-member', done: false, optional: false },
    { key: 'pick-focus-point', done: false, optional: false },
  ],
  checklistComplete: false,
  checklistDismissed: false,
  unseenFeatureKeys: ['focus-points', 'telegram'],
  ...o,
});
const auth = { headers: { Authorization: 'Bearer tok' } };

// A tiny stateful stand-in for the server: dismiss / restore flip the flag that the next GET returns,
// like the real endpoints (the hooks refetch after writing).
let server: ReturnType<typeof mgmt>;
const serveStatus = (o: object = {}) => {
  server = mgmt(o);
  mockedAxios.get.mockImplementation(() => Promise.resolve({ data: { ...server } }));
  mockedAxios.post.mockImplementation((url: string) => {
    if (url.endsWith('/dismiss-checklist')) server.checklistDismissed = true;
    if (url.endsWith('/restore-checklist')) server.checklistDismissed = false;
    return Promise.resolve({ data: {} });
  });
};

beforeEach(() => serveStatus());
afterEach(() => { jest.clearAllMocks(); mockedAxios.get.mockReset(); mockedAxios.post.mockReset(); });

describe('useOnboarding (feature 21)', () => {
  it('loads status on mount only, with the token, and again when refreshKey changes — never on its own', async () => {
    const { result, rerender } = await renderHook(({ k }: { k: number }) => useOnboarding('tok', k, 4), { initialProps: { k: 0 } });
    await waitFor(() => expect(result.current.showChecklist).toBe(true));
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/onboarding/status'), auth);
    expect(result.current.progress).toEqual({ done: 1, total: 3 });
    expect(result.current.track).toBe('MANAGEMENT');

    await rerender({ k: 1 });
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
  });

  it('does nothing without a session and stays silent on a failed load', async () => {
    await renderHook(() => useOnboarding(null));
    expect(mockedAxios.get).not.toHaveBeenCalled();

    mockedAxios.get.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 500 } }));
    const { result } = await renderHook(() => useOnboarding('tok'));
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('onboarding_load_failed', { status: 500 }));
    expect(result.current.showChecklist).toBe(false);
    expect(result.current.whatsNew).toBeNull();
  });

  it('hiding the checklist hides it at once, POSTs dismiss and tracks it', async () => {
    const { result } = await renderHook(() => useOnboarding('tok', 0, 4));
    await waitFor(() => expect(result.current.showChecklist).toBe(true));
    await act(async () => { result.current.onHideChecklist(); });
    expect(result.current.showChecklist).toBe(false);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/dismiss-checklist'), {}, auth);
    expect(trackEvent).toHaveBeenCalledWith('onboarding_checklist_dismissed', { track: 'MANAGEMENT', done: 1, total: 3 });
  });

  it('a step with a button tracks the click and navigates; a step without one does neither', async () => {
    const { result } = await renderHook(() => useOnboarding('tok', 0, 4));
    await waitFor(() => expect(result.current.steps.length).toBe(3));
    const byKey = (k: string) => result.current.steps.find((s) => s.key === k)!;

    await act(async () => { result.current.onStepPress(byKey('pick-focus-point')); });
    expect(trackEvent).toHaveBeenCalledWith('onboarding_step_clicked', { stepKey: 'pick-focus-point', track: 'MANAGEMENT', done: false });
    expect(mockOpenFocusPoints).toHaveBeenCalledWith(4);

    (trackEvent as jest.Mock).mockClear();
    await act(async () => { result.current.onStepPress(byKey('invite-member')); });
    expect(trackEvent).not.toHaveBeenCalledWith('onboarding_step_clicked', expect.anything());
  });

  it('create-team leads to /settings', async () => {
    mockedAxios.get.mockResolvedValue({ data: mgmt({ track: 'MANAGEMENT', steps: [{ key: 'create-team', done: false, optional: false }] }) });
    const { result } = await renderHook(() => useOnboarding('tok'));
    await waitFor(() => expect(result.current.steps.length).toBe(1));
    await act(async () => { result.current.onStepPress(result.current.steps[0]); });
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  describe("what's new (decisions #4/#5/#15)", () => {
    it('shows one card (the first unseen), tracks shown once, and does NOT mark it seen just by loading', async () => {
      const { result, rerender } = await renderHook(({ k }: { k: number }) => useOnboarding('tok', k, 4), { initialProps: { k: 0 } });
      await waitFor(() => expect(result.current.whatsNew?.key).toBe('focus-points'));
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('whats_new_shown', { featureKey: 'focus-points', track: 'MANAGEMENT' });

      await rerender({ k: 1 });
      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect((trackEvent as jest.Mock).mock.calls.filter((c) => c[0] === 'whats_new_shown')).toHaveLength(1);
    });

    it('closing records seen, tracks it, and the next card waits for the next dashboard entry (survives a refresh)', async () => {
      const { result, rerender } = await renderHook(({ k }: { k: number }) => useOnboarding('tok', k, 4), { initialProps: { k: 0 } });
      await waitFor(() => expect(result.current.whatsNew).not.toBeNull());
      await act(async () => { result.current.onWhatsNewDismiss(); });
      expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/seen-features'), { keys: ['focus-points'] }, auth);
      expect(trackEvent).toHaveBeenCalledWith('whats_new_dismissed', { featureKey: 'focus-points', track: 'MANAGEMENT' });
      expect(result.current.whatsNew).toBeNull();

      mockedAxios.get.mockResolvedValue({ data: mgmt({ unseenFeatureKeys: ['telegram'] }) });
      await rerender({ k: 1 });
      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
      expect(result.current.whatsNew).toBeNull();

      // A fresh mount (re-entering the dashboard) shows the next one.
      const next = await renderHook(() => useOnboarding('tok', 0, 4));
      await waitFor(() => expect(next.result.current.whatsNew?.key).toBe('telegram'));
    });

    it('the CTA records seen, tracks the click and navigates', async () => {
      const { result } = await renderHook(() => useOnboarding('tok', 0, 4));
      await waitFor(() => expect(result.current.whatsNew).not.toBeNull());
      await act(async () => { result.current.onWhatsNewCta(); });
      expect(trackEvent).toHaveBeenCalledWith('whats_new_cta_clicked', { featureKey: 'focus-points', track: 'MANAGEMENT' });
      expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/seen-features'), { keys: ['focus-points'] }, auth);
      expect(mockOpenFocusPoints).toHaveBeenCalledWith(4);
      expect(result.current.whatsNew).toBeNull();
    });

    it('without a managed team the focus-points card has no CTA (dismiss only)', async () => {
      const { result } = await renderHook(() => useOnboarding('tok', 0, null));
      await waitFor(() => expect(result.current.whatsNew?.key).toBe('focus-points'));
      expect(result.current.whatsNew?.effectiveCta).toBe('none');
      await act(async () => { result.current.onWhatsNewCta(); });
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('ignores unseen keys this client has no wording for', async () => {
      mockedAxios.get.mockResolvedValue({ data: mgmt({ unseenFeatureKeys: ['future-feature'] }) });
      const { result } = await renderHook(() => useOnboarding('tok', 0, 4));
      await waitFor(() => expect(result.current.showChecklist).toBe(true));
      expect(result.current.whatsNew).toBeNull();
    });
  });
});

describe('useQuickStart (decision #13)', () => {
  it('reflects the dismissed flag and restores: POST, track, local flip, and a signal for the dashboard', async () => {
    serveStatus({ checklistDismissed: true });
    const changed = jest.fn();
    const unsubscribe = subscribeOnboardingChanged(changed);
    const { result } = await renderHook(() => useQuickStart('tok'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.dismissed).toBe(true);

    await act(async () => { await result.current.restore(); });
    unsubscribe();
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/restore-checklist'), {}, auth);
    expect(trackEvent).toHaveBeenCalledWith('onboarding_checklist_restored');
    expect(result.current.dismissed).toBe(false);
    expect(changed).toHaveBeenCalled();
  });

  it('a failed restore keeps it dismissed and shows an error; a failed load keeps the card hidden', async () => {
    serveStatus({ checklistDismissed: true });
    mockedAxios.post.mockRejectedValue(new Error('x'));
    const { result } = await renderHook(() => useQuickStart('tok'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => { await result.current.restore(); });
    expect(result.current.dismissed).toBe(true);
    expect(result.current.error).toBeTruthy();

    mockedAxios.get.mockRejectedValue(new Error('x'));
    const failed = await renderHook(() => useQuickStart('tok'));
    await act(async () => { await Promise.resolve(); });
    expect(failed.result.current.loaded).toBe(false);
  });
});
