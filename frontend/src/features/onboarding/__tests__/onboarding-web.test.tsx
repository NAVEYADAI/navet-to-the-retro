/**
 * @jest-environment jsdom
 *
 * Feature 21 §21.2, web: the dashboard checklist (per track), hiding it, and the one-at-a-time
 * "what's new" card — through the real hook with a stateful fake server.
 */
import React from 'react';
import axios from 'axios';
import { OnboardingChecklistWeb } from '../components/onboarding-checklist-web';
import { WhatsNewCardWeb } from '../components/whats-new-card-web';
import { useOnboarding } from '../hooks/use-onboarding';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { mountWeb, clickText, type Mounted } from '@/test-utils/web-dom';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockPush = jest.fn();
const mockOpenFocusPoints = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/sprint-routes', () => ({ openFocusPoints: (...a: unknown[]) => mockOpenFocusPoints(...a) }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.setTimeout(30000);

const S = Strings.onboarding;
let mounted: Mounted | null = null;
let server: any;

function Harness() {
  const onboarding = useOnboarding('tok', 0, 4);
  return (
    <>
      <OnboardingChecklistWeb onboarding={onboarding} />
      <WhatsNewCardWeb onboarding={onboarding} />
    </>
  );
}

beforeEach(() => {
  // Icon renders react-native-svg elements under jsdom, which React flags as casing noise.
  jest.spyOn(console, 'error').mockImplementation(() => {});
  server = {
    track: 'MANAGEMENT',
    steps: [
      { key: 'create-team', done: true, optional: false },
      { key: 'invite-member', done: false, optional: false },
      { key: 'pick-focus-point', done: false, optional: false },
    ],
    checklistComplete: false,
    checklistDismissed: false,
    unseenFeatureKeys: [],
  };
  mockedAxios.get.mockImplementation(() => Promise.resolve({ data: { ...server } }));
  mockedAxios.post.mockResolvedValue({ data: {} });
});
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('onboarding checklist (web)', () => {
  it('management track: progress, finished step collapsed, pending steps with their wording; buttons only where there is a destination', async () => {
    mounted = await mountWeb(<Harness />);
    const c = mounted.container;
    expect(c.textContent).toContain(S.checklistTitle);
    expect(c.textContent).toContain(S.checklistSubtitleManagement);
    expect(c.textContent).toContain(S.progress(1, 3));
    const rows = Array.from(c.querySelectorAll('[data-testid="onboarding-step"]'));
    expect(rows.map((r) => r.getAttribute('data-step-key'))).toEqual(['create-team', 'invite-member', 'pick-focus-point']);
    expect(rows[0].textContent).toContain(S.stepDone);
    expect(rows[0].textContent).not.toContain(S.steps['create-team'].description);
    expect(rows[1].textContent).toContain(S.steps['invite-member'].description);
    expect(rows[1].querySelector('button')).toBeNull();
    expect(rows[2].querySelector('button')?.textContent).toBe(S.steps['pick-focus-point'].cta);
  });

  it('member track shows its own subtitle, the recommended badge, and a settings button for Telegram', async () => {
    server.track = 'MEMBER';
    server.steps = [
      { key: 'join-team', done: true, optional: false },
      { key: 'first-comment', done: false, optional: false },
      { key: 'connect-telegram', done: false, optional: true },
    ];
    mounted = await mountWeb(<Harness />);
    const c = mounted.container;
    expect(c.textContent).toContain(S.checklistSubtitleMember);
    expect(c.textContent).toContain(S.stepRecommended);
    expect(c.textContent).toContain(S.progress(1, 2));
    await clickText(c, S.steps['connect-telegram'].cta!);
    expect(trackEvent).toHaveBeenCalledWith('onboarding_step_clicked', { stepKey: 'connect-telegram', track: 'MEMBER', done: false });
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('"הסתר" removes the checklist, POSTs dismiss and tracks it; it stays gone after a reload', async () => {
    mockedAxios.post.mockImplementation(() => { server.checklistDismissed = true; return Promise.resolve({ data: {} }); });
    mounted = await mountWeb(<Harness />);
    await clickText(mounted.container, S.hideButton);
    expect(mounted.container.querySelector('[data-testid="onboarding-checklist"]')).toBeNull();
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/dismiss-checklist'), {}, expect.anything());
    expect(trackEvent).toHaveBeenCalledWith('onboarding_checklist_dismissed', { track: 'MANAGEMENT', done: 1, total: 3 });
    mounted.unmount();
    mounted = await mountWeb(<Harness />);
    expect(mounted.container.querySelector('[data-testid="onboarding-checklist"]')).toBeNull();
  });

  it('renders nothing once everything required is done', async () => {
    server.checklistComplete = true;
    mounted = await mountWeb(<Harness />);
    expect(mounted.container.querySelector('[data-testid="onboarding-checklist"]')).toBeNull();
  });
});

describe("what's new card (web)", () => {
  beforeEach(() => { server.unseenFeatureKeys = ['focus-points', 'telegram']; });

  it('shows exactly one card, with the management-only badge, and records nothing just by appearing', async () => {
    mounted = await mountWeb(<Harness />);
    const cards = mounted.container.querySelectorAll('[data-testid="whats-new-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('data-feature-key')).toBe('focus-points');
    expect(cards[0].textContent).toContain(Strings.onboarding.features['focus-points'].title);
    expect(cards[0].textContent).toContain(S.managementOnlyBadge);
    expect(trackEvent).toHaveBeenCalledWith('whats_new_shown', { featureKey: 'focus-points', track: 'MANAGEMENT' });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('closing records the key as seen and tracks it', async () => {
    mounted = await mountWeb(<Harness />);
    await clickText(mounted.container, S.whatsNewDismissButton);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/seen-features'), { keys: ['focus-points'] }, expect.anything());
    expect(trackEvent).toHaveBeenCalledWith('whats_new_dismissed', { featureKey: 'focus-points', track: 'MANAGEMENT' });
    expect(mounted.container.querySelector('[data-testid="whats-new-card"]')).toBeNull();
  });

  it('the CTA records seen, tracks it, and opens the improvement points of the managed team', async () => {
    mounted = await mountWeb(<Harness />);
    await clickText(mounted.container, Strings.onboarding.features['focus-points'].cta);
    expect(trackEvent).toHaveBeenCalledWith('whats_new_cta_clicked', { featureKey: 'focus-points', track: 'MANAGEMENT' });
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/seen-features'), { keys: ['focus-points'] }, expect.anything());
    expect(mockOpenFocusPoints).toHaveBeenCalledWith(4);
  });
});
