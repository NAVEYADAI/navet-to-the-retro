import { Strings } from '@/constants/strings';
import type { CtaKind } from './types';

// Feature 21 §21.0 default #3: the single frontend source of truth for "what the system can do".
// Keys / audience / since mirror backend/src/onboarding/onboarding-features.ts (the backend decides
// *who* is told and *when*; this file owns the wording and the call to action). The "discover the
// system" screen (decision #14) is deferred to stage B, but is meant to render straight from here.
export type FeatureAudience = 'MEMBER' | 'MANAGEMENT' | 'ALL';

export interface FeatureEntry {
  key: string;
  audience: FeatureAudience;
  title: string;
  description: string;
  cta: CtaKind;
  ctaLabel?: string;
  /** ISO date the feature shipped. */
  since: string;
}

const F = Strings.onboarding.features;

export const FEATURE_REGISTRY: FeatureEntry[] = [
  { key: 'focus-points', audience: 'MANAGEMENT', since: '2026-10-15', title: F['focus-points'].title, description: F['focus-points'].description, cta: 'focus-points', ctaLabel: F['focus-points'].cta },
  { key: 'team-logo', audience: 'ALL', since: '2026-10-13', title: F['team-logo'].title, description: F['team-logo'].description, cta: 'none' },
  { key: 'telegram', audience: 'ALL', since: '2026-09-28', title: F.telegram.title, description: F.telegram.description, cta: 'settings', ctaLabel: F.telegram.cta },
  { key: 'comment-categories', audience: 'ALL', since: '2026-09-19', title: F['comment-categories'].title, description: F['comment-categories'].description, cta: 'none' },
  { key: 'google-calendar', audience: 'ALL', since: '2026-09-11', title: F['google-calendar'].title, description: F['google-calendar'].description, cta: 'settings', ctaLabel: F['google-calendar'].cta },
  { key: 'phantom-members', audience: 'MANAGEMENT', since: '2026-09-14', title: F['phantom-members'].title, description: F['phantom-members'].description, cta: 'none' },
  { key: 'pptx-export', audience: 'ALL', since: '2026-09-02', title: F['pptx-export'].title, description: F['pptx-export'].description, cta: 'none' },
];

export function getFeature(key: string): FeatureEntry | undefined {
  return FEATURE_REGISTRY.find((f) => f.key === key);
}
