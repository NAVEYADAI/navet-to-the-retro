export class SeenFeaturesDto {
  keys!: string[];
}

export type OnboardingTrack = 'MEMBER' | 'MANAGEMENT';

export interface OnboardingStepDto {
  key: string;
  done: boolean;
  // Optional steps (e.g. linking Telegram) are shown as "recommended" and never block completion.
  optional: boolean;
}

export interface OnboardingStatusDto {
  track: OnboardingTrack;
  steps: OnboardingStepDto[];
  // True when every non-optional step is done — the client hides a completed checklist.
  checklistComplete: boolean;
  checklistDismissed: boolean;
  unseenFeatureKeys: string[];
}
