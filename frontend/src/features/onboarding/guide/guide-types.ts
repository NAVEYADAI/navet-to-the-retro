import type { OnboardingStatus } from '../types';

// Feature 22 (product-backlog/22-interactive-guide.md): a guide is a list of steps, each of which
// highlights a real element (an "anchor") and either waits for the user to act on it or for "next".
export type GuideId = 'basic' | 'advanced';

export type GuidePlatform = 'web' | 'native';

/** Events other parts of the app emit so the guide knows the user really did something. */
export type GuideSignal = 'comment-posted';

export type AdvanceOn =
  /** The user reads and presses "הבא". */
  | { type: 'next' }
  /** The user presses the real element (the step's anchor unless `anchor` says otherwise). */
  | { type: 'press'; anchor?: string }
  /** The app reports that the action happened (e.g. a comment was posted). */
  | { type: 'signal'; name: GuideSignal };

/** What the guide knows about the user, derived from GET /onboarding/status (+ the platform). */
export interface GuideContext {
  platform: GuidePlatform;
  /** Management track (leader / admin of a team, or no team yet). */
  isManagement: boolean;
  hasTeam: boolean;
  /** Management track AND has a team to manage. */
  canManage: boolean;
  teamId: number | null;
  activeSprintId: number | null;
  endedSprintId: number | null;
  hasActiveSprint: boolean;
  hasEndedSprint: boolean;
}

export interface GuideStep {
  /** Key into Strings.onboarding.guide.steps (title + body). */
  id: string;
  /** MANAGEMENT steps are for the management track only. */
  audience: 'ALL' | 'MANAGEMENT';
  /** Omitted = both platforms. */
  platforms?: GuidePlatform[];
  /** Route to be on before the step shows (null/omitted = stay where the user is). */
  route?: (ctx: GuideContext) => string | null;
  /** `data-tour` key of the element to highlight; omitted = a centred note with no highlight. */
  anchor?: string;
  /** Render the client-side demo board (never touches the API) behind the highlight. */
  demo?: boolean;
  advanceOn: AdvanceOn;
  /** Extra condition, e.g. "the user has no active sprint yet". */
  requires?: (ctx: GuideContext) => boolean;
}

export type GuideTrack = OnboardingStatus['track'];
