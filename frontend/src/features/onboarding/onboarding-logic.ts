import { Strings } from '@/constants/strings';
import { getFeature, type FeatureEntry } from './registry';
import type { CtaKind, OnboardingHints, OnboardingStatus, OnboardingStep } from './types';

// Pure helpers for feature 21 — no React, no network — so the rules are unit-testable.

export interface StepText {
  title: string;
  description: string;
  cta?: string;
}

/** Text for a step key, or undefined for a key this client doesn't know (newer server) — such steps are skipped. */
export function getStepText(key: string): StepText | undefined {
  return (Strings.onboarding.steps as Record<string, StepText>)[key];
}

export function knownSteps(status: OnboardingStatus): OnboardingStep[] {
  return status.steps.filter((s) => getStepText(s.key) !== undefined);
}

/** §21.0 #12/#13: shown only while something required is missing and the user hasn't hidden it. */
export function shouldShowChecklist(status: OnboardingStatus | null): boolean {
  if (!status) return false;
  return !status.checklistDismissed && !status.checklistComplete && knownSteps(status).length > 0;
}

/** Progress counts required steps only — the optional "recommended" one never blocks completion. */
export function checklistProgress(status: OnboardingStatus): { done: number; total: number } {
  const required = knownSteps(status).filter((s) => !s.optional);
  return { done: required.filter((s) => s.done).length, total: required.length };
}

/** §21.0 #5/#15: one card at a time — the first unseen key (server order) this client has wording for. */
export function pickWhatsNew(status: OnboardingStatus | null): FeatureEntry | null {
  if (!status) return null;
  for (const key of status.unseenFeatureKeys) {
    const feature = getFeature(key);
    if (feature) return feature;
  }
  return null;
}

/** What pressing a step does. Steps without a button (they live inside the team cards) return 'none'. */
export function stepCta(stepKey: string, canOpenFocusPoints: boolean, hints?: OnboardingHints): CtaKind {
  switch (stepKey) {
    case 'create-team':
    case 'connect-telegram':
      return 'settings';
    case 'pick-focus-point':
      return canOpenFocusPoints ? 'focus-points' : 'none';
    // Only offered when a sprint is running; the other steps happen inside the team card (and a finished
    // "close sprint" collapses, so a button there would never show).
    case 'first-comment':
      return hints?.teamId != null && hints.activeSprintId != null ? 'sprint-board' : 'none';
    default:
      return 'none';
  }
}

/**
 * The team the management steps point at: the first approved team where I'm an active admin /
 * team leader (same predicate as the backend's `assertCanManageTeamContent`). Null when none.
 */
export function findManagedTeamId(teams: any[], userId: number): number | null {
  for (const team of teams) {
    if (team.status === 'PENDING_APPROVAL') continue;
    const me = team.members?.find((m: any) => m.userId === userId);
    if (!me || (me.status ?? 'ACTIVE') !== 'ACTIVE') continue;
    if (me.isAdmin || me.role === 'TEAM_LEADER') return team.id;
  }
  return null;
}
