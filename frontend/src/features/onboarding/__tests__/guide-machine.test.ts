import { advance, currentStep, goBack, isFirstStep, isInteractive, isLastStep, pressTargetOf, startSession } from '../guide/guide-machine';
import type { GuideContext, GuideStep } from '../guide/guide-types';

const ctx: GuideContext = { platform: 'web', isManagement: true, hasTeam: true, canManage: true, teamId: 1, activeSprintId: 2, endedSprintId: 3, hasActiveSprint: true, hasEndedSprint: true };
const steps: GuideStep[] = [
  { id: 'a', audience: 'ALL', advanceOn: { type: 'next' } },
  { id: 'b', audience: 'ALL', anchor: 'btn', advanceOn: { type: 'press' } },
  { id: 'c', audience: 'ALL', anchor: 'form', advanceOn: { type: 'press', anchor: 'submit' } },
  { id: 'd', audience: 'ALL', anchor: 'compose', advanceOn: { type: 'signal', name: 'comment-posted' } },
];

describe('guide state machine', () => {
  it('has no session without steps', () => {
    expect(startSession('basic', [], ctx, false)).toBeNull();
  });

  it('starts on the first step and walks forward to the end, where "next" completes the guide', () => {
    let s = startSession('basic', steps, ctx, true)!;
    expect(s.auto).toBe(true);
    expect(currentStep(s).id).toBe('a');
    expect(isFirstStep(s)).toBe(true);
    s = advance(s)!; s = advance(s)!; s = advance(s)!;
    expect(currentStep(s).id).toBe('d');
    expect(isLastStep(s)).toBe(true);
    expect(advance(s)).toBeNull();
  });

  it('goes back one step and stays put on the first', () => {
    let s = startSession('basic', steps, ctx, false)!;
    expect(goBack(s)).toBe(s);
    s = advance(advance(s)!)!;
    expect(currentStep(goBack(s)).id).toBe('b');
  });

  it('knows which steps need the user to act, and what to press', () => {
    expect(steps.map(isInteractive)).toEqual([false, true, true, true]);
    expect(steps.map(pressTargetOf)).toEqual([null, 'btn', 'submit', null]);
  });
});
