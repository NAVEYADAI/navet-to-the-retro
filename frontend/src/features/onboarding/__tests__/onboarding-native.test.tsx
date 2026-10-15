import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { OnboardingChecklistNative } from '../components/onboarding-checklist-native';
import { WhatsNewCardNative } from '../components/whats-new-card-native';
import { useOnboarding } from '../hooks/use-onboarding';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.setTimeout(30000);
jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockPush = jest.fn();
const mockOpenFocusPoints = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/sprint-routes', () => ({ openFocusPoints: (...a: unknown[]) => mockOpenFocusPoints(...a) }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const S = Strings.onboarding;
let server: any;

function Harness() {
  const onboarding = useOnboarding('tok', 0, 4);
  return (
    <>
      <OnboardingChecklistNative onboarding={onboarding} />
      <WhatsNewCardNative onboarding={onboarding} />
    </>
  );
}

beforeEach(() => {
  server = {
    track: 'MANAGEMENT',
    steps: [
      { key: 'create-team', done: false, optional: false },
      { key: 'invite-member', done: false, optional: false },
    ],
    checklistComplete: false,
    checklistDismissed: false,
    unseenFeatureKeys: [],
  };
  mockedAxios.get.mockImplementation(() => Promise.resolve({ data: { ...server } }));
  mockedAxios.post.mockImplementation((url: string) => {
    if (url.endsWith('/dismiss-checklist')) server.checklistDismissed = true;
    return Promise.resolve({ data: {} });
  });
});
afterEach(() => jest.clearAllMocks());

describe('onboarding checklist (native)', () => {
  it('shows the management steps; a step with a destination navigates and tracks, one without has no button', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(<Harness />);
    await waitFor(() => expect(getByText(S.checklistTitle)).toBeTruthy());
    expect(getByText(S.progress(0, 2))).toBeTruthy();
    expect(queryByTestId('onboarding-step-button-invite-member')).toBeNull();
    await fireEvent.press(getByTestId('onboarding-step-button-create-team'));
    expect(trackEvent).toHaveBeenCalledWith('onboarding_step_clicked', { stepKey: 'create-team', track: 'MANAGEMENT', done: false });
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('member track wording and the hide button', async () => {
    server.track = 'MEMBER';
    server.steps = [{ key: 'join-team', done: true, optional: false }, { key: 'first-comment', done: false, optional: false }];
    const { getByText, getByTestId, queryByTestId } = await render(<Harness />);
    await waitFor(() => expect(getByText(S.checklistSubtitleMember)).toBeTruthy());
    await fireEvent.press(getByTestId('onboarding-hide'));
    expect(trackEvent).toHaveBeenCalledWith('onboarding_checklist_dismissed', { track: 'MEMBER', done: 1, total: 2 });
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/dismiss-checklist'), {}, expect.anything());
    await waitFor(() => expect(queryByTestId('onboarding-checklist')).toBeNull());
  });
});

describe("what's new card (native)", () => {
  beforeEach(() => { server.unseenFeatureKeys = ['focus-points']; server.checklistDismissed = true; });

  it('appears without recording anything, then the CTA records seen and navigates', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(<Harness />);
    await waitFor(() => expect(getByText(Strings.onboarding.features['focus-points'].title)).toBeTruthy());
    expect(mockedAxios.post).not.toHaveBeenCalled();
    await fireEvent.press(getByTestId('whats-new-cta'));
    expect(trackEvent).toHaveBeenCalledWith('whats_new_cta_clicked', { featureKey: 'focus-points', track: 'MANAGEMENT' });
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/seen-features'), { keys: ['focus-points'] }, expect.anything());
    expect(mockOpenFocusPoints).toHaveBeenCalledWith(4);
    expect(queryByTestId('whats-new-card')).toBeNull();
  });

  it('dismiss records seen and tracks it', async () => {
    const { getByTestId, queryByTestId } = await render(<Harness />);
    await waitFor(() => expect(getByTestId('whats-new-card')).toBeTruthy());
    await fireEvent.press(getByTestId('whats-new-dismiss'));
    expect(trackEvent).toHaveBeenCalledWith('whats_new_dismissed', { featureKey: 'focus-points', track: 'MANAGEMENT' });
    expect(queryByTestId('whats-new-card')).toBeNull();
  });
});
