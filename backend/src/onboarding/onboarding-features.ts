// Feature 21 §21.0 default #3 / #12: the single source of truth for which feature keys exist, who
// should be told about them, and when they shipped. Titles, descriptions and CTAs live in the
// frontend registry (`features/onboarding/registry.ts`) — the backend only needs key, audience and
// date to decide what is "unseen" for a given user. Unknown keys sent by a client are ignored
// (see OnboardingService.markFeaturesSeen), so the two registries may drift without breaking.
//
// audience: MANAGEMENT = only users who manage at least one active team (isAdmin or TEAM_LEADER);
// MEMBER / ALL = everyone (management is a superset of a member, §21.0 decision #2).
export type FeatureAudience = 'MEMBER' | 'MANAGEMENT' | 'ALL';

export interface OnboardingFeature {
  key: string;
  audience: FeatureAudience;
  // ISO date (UTC midnight). Only features with `since >= WHATS_NEW_SINCE` surface as "what's new";
  // older ones exist for the future "discover the system" catalogue (§21.0 decision #14).
  since: string;
}

// §21.0 decision #12: don't flood existing users with old features.
export const WHATS_NEW_SINCE = '2026-10-15';

// Order matters only as a tie-break between features with the same `since`.
export const ONBOARDING_FEATURES: OnboardingFeature[] = [
  { key: 'focus-points', audience: 'MANAGEMENT', since: '2026-10-15' },
  { key: 'team-logo', audience: 'ALL', since: '2026-10-13' },
  { key: 'telegram', audience: 'ALL', since: '2026-09-28' },
  { key: 'comment-categories', audience: 'ALL', since: '2026-09-19' },
  { key: 'google-calendar', audience: 'ALL', since: '2026-09-11' },
  { key: 'phantom-members', audience: 'MANAGEMENT', since: '2026-09-14' },
  { key: 'pptx-export', audience: 'ALL', since: '2026-09-02' },
];

export const KNOWN_FEATURE_KEYS: ReadonlySet<string> = new Set(ONBOARDING_FEATURES.map((f) => f.key));
