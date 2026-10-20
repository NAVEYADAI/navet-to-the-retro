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

// Where the checklist's buttons can lead (the team the steps refer to + the sprint running today).
export interface OnboardingHintsDto {
  teamId: number | null;
  activeSprintId: number | null;
  // The team's latest finished sprint — where the interactive guide's summary/PPTX step navigates (feature 22).
  endedSprintId: number | null;
}

export interface OnboardingStatusDto {
  track: OnboardingTrack;
  steps: OnboardingStepDto[];
  // True when every non-optional step is done — the client hides a completed checklist.
  checklistComplete: boolean;
  checklistDismissed: boolean;
  unseenFeatureKeys: string[];
  hints: OnboardingHintsDto;
  // Feature 22: a brand-new user (no comment, no sprint) whose interactive guide was never auto-opened.
  guideAutoStart: boolean;
}
