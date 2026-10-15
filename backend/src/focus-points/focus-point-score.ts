// Feature 20 (product-backlog/20-issue-tracking.md §20.0 #11-#19): the scoring rules as pure
// functions, so the thresholds live in one place and are tested without a database.

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;
/** Raters needed before a result may be shown — below this anonymity would be too weak (#15). */
export const MIN_RATERS = 3;
/** Average at which an improvement point counts as done and closes (#16). */
export const CLOSE_AVERAGE = 4.5;
/** "Meaningful improvement" as a share of the scale (#17); default 10% = 0.5 points. */
export const IMPROVEMENT_RATIO = 0.1;

export type Trend = 'IMPROVED' | 'DECLINED' | 'SAME';

export interface SprintRatingSummary {
  raterCount: number;
  /** null when the result must stay hidden (too few raters, or a team too small to stay anonymous). */
  average: number | null;
  valid: boolean;
}

export function averageOf(scores: number[]): number {
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/** A team below the minimum can never show a result — everyone would know who rated what (#19). */
export function canShowResults(activeHumanMembers: number, raterCount: number): boolean {
  return activeHumanMembers >= MIN_RATERS && raterCount >= MIN_RATERS;
}

export function summarizeSprintRatings(scores: number[], activeHumanMembers: number): SprintRatingSummary {
  const valid = canShowResults(activeHumanMembers, scores.length);
  return { raterCount: scores.length, valid, average: valid ? averageOf(scores) : null };
}

/**
 * Change between two scores. It counts only if it reaches the system threshold AND exceeds the step
 * one rater moving a single point would cause (1/n) — so in a small team one person's nudge is noise (#17).
 */
export function trendBetween(previous: number, next: number, raterCount: number): Trend {
  const diff = next - previous;
  const threshold = IMPROVEMENT_RATIO * (SCORE_MAX - SCORE_MIN + 1);
  const singleRaterStep = raterCount > 0 ? 1 / raterCount : Infinity;
  if (Math.abs(diff) < threshold - 1e-9 || Math.abs(diff) <= singleRaterStep + 1e-9) return 'SAME';
  return diff > 0 ? 'IMPROVED' : 'DECLINED';
}

export function reachedGoal(average: number): boolean {
  return average >= CLOSE_AVERAGE - 1e-9;
}

export interface HistoryEntry {
  raterCount: number;
  average: number | null;
  valid: boolean;
  trend: Trend | null;
}

/**
 * Adds a trend to each sprint (oldest first). The baseline for the first valid sprint is the
 * starting score management set; an invalid sprint has no trend and doesn't move the baseline (#18).
 */
export function buildHistory(initialScore: number | null, sprints: SprintRatingSummary[]): { entries: HistoryEntry[]; currentScore: number | null } {
  let baseline = initialScore;
  const entries = sprints.map((s) => {
    if (!s.valid || s.average === null) return { raterCount: s.raterCount, average: null, valid: false, trend: null };
    const trend = baseline === null ? null : trendBetween(baseline, s.average, s.raterCount);
    baseline = s.average;
    return { raterCount: s.raterCount, average: s.average, valid: true, trend };
  });
  return { entries, currentScore: baseline };
}
