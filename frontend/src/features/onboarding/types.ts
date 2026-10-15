// Feature 21 — shape of GET /onboarding/status (specs/21-onboarding.md §2).
export type OnboardingTrack = 'MEMBER' | 'MANAGEMENT';

export interface OnboardingStep {
  key: string;
  done: boolean;
  optional: boolean;
}

export interface OnboardingStatus {
  track: OnboardingTrack;
  steps: OnboardingStep[];
  checklistComplete: boolean;
  checklistDismissed: boolean;
  unseenFeatureKeys: string[];
}

/** Where a CTA leads. `focus-points` needs a team the user manages (resolved by the dashboard). */
export type CtaKind = 'settings' | 'focus-points' | 'none';
