import { FEATURE_REGISTRY, type FeatureEntry } from './registry';

/**
 * Steps of the "סיור במערכת" tour, oldest feature first (so it reads like the order the system grew).
 * Management-only features are shown only to someone who manages a team — the same rule the
 * "what's new" card uses on the backend.
 */
export function getTourSteps(canSeeManagement: boolean): FeatureEntry[] {
  return [...FEATURE_REGISTRY]
    .filter((f) => f.audience !== 'MANAGEMENT' || canSeeManagement)
    .sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : 0));
}
