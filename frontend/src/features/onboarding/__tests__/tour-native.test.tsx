import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { getTourSteps } from '../tour-logic';
import { TourNative } from '../components/tour-native';
import { useTour } from '../hooks/use-tour';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.setTimeout(30000);
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockOpenFocusPoints = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/sprint-routes', () => ({ openFocusPoints: (...a: unknown[]) => mockOpenFocusPoints(...a) }));

const S = Strings.onboarding;

function Harness({ managedTeamId }: { managedTeamId: number | null }) {
  return <TourNative tour={useTour(managedTeamId)} />;
}

afterEach(() => jest.clearAllMocks());

describe('tour (native)', () => {
  it('opens from the header button and steps forward and back', async () => {
    const steps = getTourSteps(false);
    const { getByTestId, getByText, queryByText } = await render(<Harness managedTeamId={null} />);
    expect(queryByText(steps[0].title)).toBeNull();
    await fireEvent.press(getByTestId('tour-open'));
    expect(getByText(S.tourStepOf(1, steps.length))).toBeTruthy();
    expect(getByText(steps[0].title)).toBeTruthy();
    await fireEvent.press(getByTestId('tour-next'));
    expect(getByText(steps[1].title)).toBeTruthy();
    await fireEvent.press(getByTestId('tour-back'));
    expect(getByText(steps[0].title)).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith('tour_opened', { steps: steps.length, management: false });
  });

  it('a manager reaches the improvement-points step and its button opens that screen', async () => {
    const steps = getTourSteps(true);
    const { getByTestId, getByText } = await render(<Harness managedTeamId={4} />);
    await fireEvent.press(getByTestId('tour-open'));
    for (let i = 1; i < steps.length; i++) await fireEvent.press(getByTestId('tour-next'));
    expect(getByText(S.managementOnlyBadge)).toBeTruthy();
    await fireEvent.press(getByTestId('tour-cta'));
    expect(mockOpenFocusPoints).toHaveBeenCalledWith(4);
  });
});
