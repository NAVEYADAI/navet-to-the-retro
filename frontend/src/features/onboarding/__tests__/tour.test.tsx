/**
 * @jest-environment jsdom
 *
 * "סיור במערכת" (web): steps depend on whether the user manages a team, the stepper walks
 * forward/back, a step button leaves the tour, and every click is tracked.
 */
import React from 'react';
import { getTourSteps } from '../tour-logic';
import { TourWeb } from '../components/tour-web';
import { useTour } from '../hooks/use-tour';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { mountWeb, clickText, type Mounted } from '@/test-utils/web-dom';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockOpenFocusPoints = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/sprint-routes', () => ({ openFocusPoints: (...a: unknown[]) => mockOpenFocusPoints(...a) }));
jest.setTimeout(30000);

const S = Strings.onboarding;
let mounted: Mounted | null = null;

function Harness({ managedTeamId }: { managedTeamId: number | null }) {
  return <TourWeb tour={useTour(managedTeamId)} />;
}

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('getTourSteps', () => {
  it('hides management-only features from someone who manages no team, and orders oldest first', () => {
    const member = getTourSteps(false);
    expect(member.some((s) => s.audience === 'MANAGEMENT')).toBe(false);
    const manager = getTourSteps(true);
    expect(manager.length).toBeGreaterThan(member.length);
    expect(manager.map((s) => s.since)).toEqual([...manager.map((s) => s.since)].sort());
    expect(manager[manager.length - 1].key).toBe('focus-points');
  });
});

describe('tour (web)', () => {
  it('opens on the first step, walks forward and back, and finishing closes it', async () => {
    mounted = await mountWeb(<Harness managedTeamId={null} />);
    const steps = getTourSteps(false);
    expect(document.body.textContent).not.toContain(steps[0].title);
    await clickText(document.body, S.tourButton);
    expect(document.body.textContent).toContain(S.tourStepOf(1, steps.length));
    expect(document.body.textContent).toContain(steps[0].title);
    expect(trackEvent).toHaveBeenCalledWith('tour_opened', { steps: steps.length, management: false });

    await clickText(document.body, S.tourNext);
    expect(document.body.textContent).toContain(S.tourStepOf(2, steps.length));
    expect(document.body.textContent).toContain(steps[1].title);
    await clickText(document.body, S.tourBack);
    expect(document.body.textContent).toContain(steps[0].title);

    for (let i = 1; i < steps.length; i++) await clickText(document.body, S.tourNext);
    expect(document.body.textContent).toContain(S.tourStepOf(steps.length, steps.length));
    await clickText(document.body, S.tourFinish);
    expect(trackEvent).toHaveBeenCalledWith('tour_finished', expect.objectContaining({ step: steps[steps.length - 1].key }));
  });

  it('a manager sees the improvement-points step and its button opens that screen', async () => {
    mounted = await mountWeb(<Harness managedTeamId={4} />);
    const steps = getTourSteps(true);
    await clickText(document.body, S.tourButton);
    for (let i = 1; i < steps.length; i++) await clickText(document.body, S.tourNext);
    expect(document.body.textContent).toContain(S.managementOnlyBadge);
    await clickText(document.body, Strings.onboarding.features['focus-points'].cta);
    expect(mockOpenFocusPoints).toHaveBeenCalledWith(4);
    expect(trackEvent).toHaveBeenCalledWith('tour_cta_clicked', { featureKey: 'focus-points' });
  });
});
