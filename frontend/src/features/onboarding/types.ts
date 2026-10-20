// Feature 21 — shape of GET /onboarding/status (specs/21-onboarding.md §2).
export type OnboardingTrack = 'MEMBER' | 'MANAGEMENT';

export interface OnboardingStep {
  key: string;
  done: boolean;
  optional: boolean;
}

/** Where the step buttons can lead; absent from an older server (buttons then just aren't offered). */
export interface OnboardingHints {
  teamId: number | null;
  activeSprintId: number | null;
  /** Feature 22: the team's latest finished sprint (the guide's summary step opens it). */
  endedSprintId?: number | null;
}

export interface OnboardingStatus {
  track: OnboardingTrack;
  steps: OnboardingStep[];
  checklistComplete: boolean;
  checklistDismissed: boolean;
  unseenFeatureKeys: string[];
  hints?: OnboardingHints;
  /** Feature 22: a brand-new user whose interactive guide was never auto-opened. */
  guideAutoStart?: boolean;
}

/** Where a CTA leads. `focus-points` needs a team the user manages (resolved by the dashboard). */
export type CtaKind = 'settings' | 'focus-points' | 'sprint-board' | 'none';
