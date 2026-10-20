import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { emitGuideSignal } from '../guide/guide-signals';
import { GuideProvider, useGuide } from '../guide/guide-provider';
import type { OnboardingStatus } from '../types';

jest.setTimeout(30000);
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockPush = jest.fn();
let mockPathname = '/';
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) }, usePathname: () => mockPathname }));
jest.mock('@/context/auth-context', () => ({ useAuth: () => ({ token: 'tok' }) }));
jest.mock('@/lib/sprint-routes', () => ({
  sprintPath: (t: number, s: number, v = 'board') => `/team/${t}/sprint/${s}${v === 'board' ? '' : `/${v}`}`,
}));
const mockFetch = jest.fn();
const mockStarted = jest.fn();
jest.mock('../onboarding-api', () => ({
  fetchOnboardingStatus: (...a: unknown[]) => mockFetch(...a),
  postGuideStarted: (...a: unknown[]) => mockStarted(...a),
}));

// The real anchor registry needs a native view tree; the guide's own logic is what is under test here.
let mockAnchorFound = true;
const mockPressListeners = new Set<(n: string) => void>();
jest.mock('@/components/ui/guide-anchor', () => ({
  GuideAnchor: ({ children }: { children: React.ReactNode }) => children,
  subscribeAnchorPress: (name: string, cb: () => void) => {
    const l = (n: string) => { if (n === name) cb(); };
    mockPressListeners.add(l);
    return () => { mockPressListeners.delete(l); };
  },
  waitForAnchor: () => ({ promise: Promise.resolve(mockAnchorFound), cancel: () => {} }),
  measureAnchorNative: () => Promise.resolve({ x: 20, y: 200, width: 120, height: 40 }),
}));
const press = (name: string) => mockPressListeners.forEach((l) => l(name));

const G = Strings.onboarding.guide;
const status = (over: Partial<OnboardingStatus> = {}, hints: object = {}): OnboardingStatus => ({
  track: 'MANAGEMENT', steps: [], checklistComplete: false, checklistDismissed: false, unseenFeatureKeys: [],
  hints: { teamId: 7, activeSprintId: 40, endedSprintId: 31, ...hints }, ...over,
});

function Starter() {
  const guide = useGuide();
  return (
    <>
      <Text testID="state">{guide.active ? 'active' : 'idle'}</Text>
      <Text testID="start-basic" onPress={() => guide.start('basic')}>start</Text>
      <Text testID="start-adv" onPress={() => guide.start('advanced')}>adv</Text>
    </>
  );
}
const mountGuide = () => render(<GuideProvider><Starter /></GuideProvider>);
const stepId = (utils: ReturnType<typeof render>) => utils.queryByTestId('guide-bubble');

beforeEach(() => {
  mockAnchorFound = true;
  mockPathname = '/';
  mockFetch.mockResolvedValue(status());
  mockStarted.mockResolvedValue(undefined);
});
afterEach(() => { jest.clearAllMocks(); jest.useRealTimers(); });

const startBasic = async (utils: ReturnType<typeof render>) => {
  await fireEvent.press(utils.getByTestId('start-basic'));
  await waitFor(() => expect(utils.getByTestId('state').props.children).toBe('active'));
  await waitFor(() => expect(utils.getByText(G.steps.welcome.title)).toBeTruthy());
};

describe('GuideProvider (feature 22)', () => {
  it('starts from a fresh status read and shows the first step with "n of N"', async () => {
    const utils = await mountGuide();
    await startBasic(utils);
    expect(mockFetch).toHaveBeenCalledWith('tok');
    expect(utils.getByText(G.stepOf(1, 9))).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith('guide_started', { guide: 'basic', auto: false });
    expect(trackEvent).toHaveBeenCalledWith('guide_step_shown', { id: 'welcome', guide: 'basic' });
  });

  it('opens by itself for a brand-new user, tells the server once, and never for others', async () => {
    mockFetch.mockResolvedValue(status({ guideAutoStart: true }));
    const utils = await mountGuide();
    await waitFor(() => expect(utils.getByText(G.steps.welcome.title)).toBeTruthy());
    expect(mockStarted).toHaveBeenCalledWith('tok');
    expect(trackEvent).toHaveBeenCalledWith('guide_started', { guide: 'basic', auto: true });
  });

  it('does not open for an existing user', async () => {
    const utils = await mountGuide();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(stepId(utils)).toBeNull();
    expect(mockStarted).not.toHaveBeenCalled();
  });

  it('walks "הבא" through reading steps, navigates to each step’s route, and finishes', async () => {
    mockFetch.mockResolvedValue(status({}, { activeSprintId: null, endedSprintId: null }));
    const utils = await mountGuide();
    await startBasic(utils);
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByText(G.steps['members-toggle'].title)).toBeTruthy());
    // a press step: no "הבא", the real press moves it on
    expect(utils.queryByTestId('guide-next')).toBeNull();
    expect(utils.getByText(G.actionHint)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled(); // already on "/"
  });

  it('moves a press step on only when the real element is pressed', async () => {
    const utils = await mountGuide();
    await startBasic(utils);
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByText(G.steps['members-toggle'].title)).toBeTruthy());
    await act(async () => { press('some-other-anchor'); });
    expect(utils.getByText(G.steps['members-toggle'].title)).toBeTruthy();
    await act(async () => { press('team-members-toggle'); });
    await waitFor(() => expect(utils.getByText(G.steps['add-member-native'].title)).toBeTruthy(), { timeout: 3000 });
    expect(trackEvent).toHaveBeenCalledWith('guide_step_done', { id: 'members-toggle', guide: 'basic', via: 'click' });
  });

  it('a signal (the user posted a note) moves the writing step on, after a short pause', async () => {
    const utils = await mountGuide();
    await startBasic(utils);
    // jump to the board step: welcome → toggle → add-member → sprint-new → board-write
    await fireEvent.press(utils.getByTestId('guide-next'));
    await act(async () => { press('team-members-toggle'); });
    await waitFor(() => expect(utils.getByText(G.steps['add-member-native'].title)).toBeTruthy(), { timeout: 3000 });
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByText(G.steps['sprint-new'].title)).toBeTruthy());
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByText(G.steps['board-write'].title)).toBeTruthy());
    expect(mockPush).toHaveBeenCalledWith('/team/7/sprint/40');
    expect(utils.getByText(G.writeHint)).toBeTruthy();
    await act(async () => { emitGuideSignal('comment-posted'); });
    await waitFor(() => expect(utils.getByText(G.steps['board-comments'].title)).toBeTruthy(), { timeout: 4000 });
    expect(trackEvent).toHaveBeenCalledWith('guide_step_done', { id: 'board-write', guide: 'basic', via: 'signal' });
  });

  it('back goes one step back; skip moves on; exit leaves and a new start begins at step 1', async () => {
    const utils = await mountGuide();
    await startBasic(utils);
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByText(G.steps['members-toggle'].title)).toBeTruthy());
    await fireEvent.press(utils.getByTestId('guide-back'));
    await waitFor(() => expect(utils.getByText(G.steps.welcome.title)).toBeTruthy());
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByTestId('guide-skip')).toBeTruthy());
    await fireEvent.press(utils.getByTestId('guide-skip'));
    await waitFor(() => expect(utils.getByText(G.steps['add-member-native'].title)).toBeTruthy());
    expect(trackEvent).toHaveBeenCalledWith('guide_skipped', { id: 'members-toggle', guide: 'basic' });

    await fireEvent.press(utils.getByTestId('guide-exit'));
    expect(stepId(utils)).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('guide_exited', { guide: 'basic', atStep: 'add-member-native' });
    await startBasic(utils);
  });

  it('an anchor that never shows up becomes a plain note with "הבא" — and is reported', async () => {
    mockAnchorFound = false;
    const utils = await mountGuide();
    await startBasic(utils);
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByText(G.steps['members-toggle'].title)).toBeTruthy());
    expect(trackEvent).toHaveBeenCalledWith('guide_anchor_missing', { id: 'members-toggle', guide: 'basic' });
    expect(utils.getByTestId('guide-next')).toBeTruthy();
    expect(utils.queryByTestId('guide-highlight')).toBeNull();
  });

  it('highlights the anchor with a ring and four dimming panels around it', async () => {
    const utils = await mountGuide();
    await startBasic(utils);
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByTestId('guide-highlight')).toBeTruthy());
    expect(utils.getAllByTestId('guide-dim')).toHaveLength(4);
  });

  it('the last step says "סיום" and completing it closes the guide', async () => {
    mockFetch.mockResolvedValue(status({}, { teamId: null, activeSprintId: null, endedSprintId: null }));
    const utils = await mountGuide();
    await fireEvent.press(utils.getByTestId('start-adv'));
    await waitFor(() => expect(utils.getByText(G.steps['adv-welcome'].title)).toBeTruthy());
    for (let i = 0; i < 20; i += 1) {
      if (utils.queryByText(G.finish)) break;
      await fireEvent.press(utils.getByTestId('guide-next'));
      await new Promise((r) => setTimeout(r, 20));
    }
    await fireEvent.press(utils.getByTestId('guide-next'));
    await waitFor(() => expect(utils.getByTestId('state').props.children).toBe('idle'));
    expect(trackEvent).toHaveBeenCalledWith('guide_completed', { guide: 'advanced' });
  });

  it('a failed status read still opens a guide (data-free steps + demo)', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const utils = await mountGuide();
    await startBasic(utils);
    expect(utils.getByText(G.stepOf(1, 6))).toBeTruthy();
  });
});
