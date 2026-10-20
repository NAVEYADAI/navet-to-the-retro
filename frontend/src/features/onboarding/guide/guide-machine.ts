import type { GuideContext, GuideId, GuideStep } from './guide-types';

// The guide's state machine, kept pure so it can be tested without a screen. Progress lives in
// memory only (§22.0 default #8): leaving the guide and starting it again begins at step 1.
export interface GuideSession {
  guide: GuideId;
  steps: GuideStep[];
  ctx: GuideContext;
  index: number;
  /** Opened automatically for a brand-new user (vs. from the menu). */
  auto: boolean;
}

export function startSession(guide: GuideId, steps: GuideStep[], ctx: GuideContext, auto: boolean): GuideSession | null {
  return steps.length === 0 ? null : { guide, steps, ctx, index: 0, auto };
}

export const currentStep = (s: GuideSession): GuideStep => s.steps[s.index];
export const isFirstStep = (s: GuideSession): boolean => s.index === 0;
export const isLastStep = (s: GuideSession): boolean => s.index >= s.steps.length - 1;

/** The session after "next", or null when the last step was completed. */
export function advance(s: GuideSession): GuideSession | null {
  return isLastStep(s) ? null : { ...s, index: s.index + 1 };
}

/** One step back; the first step stays put. */
export function goBack(s: GuideSession): GuideSession {
  return isFirstStep(s) ? s : { ...s, index: s.index - 1 };
}

/** Does the user have to act (press / write) to move on, rather than just read? */
export function isInteractive(step: GuideStep): boolean {
  return step.advanceOn.type !== 'next';
}

/** The `data-tour` key whose press moves a `press` step on. */
export function pressTargetOf(step: GuideStep): string | null {
  return step.advanceOn.type === 'press' ? (step.advanceOn.anchor ?? step.anchor ?? null) : null;
}
