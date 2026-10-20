import type { OnboardingStatus } from '../types';
import { ADVANCED_STEPS } from './guide-script-advanced';
import { BASIC_STEPS } from './guide-script-basic';
import type { GuideContext, GuideId, GuidePlatform, GuideStep } from './guide-types';

export { BASIC_STEPS, ADVANCED_STEPS };

export function scriptFor(guide: GuideId): GuideStep[] {
  return guide === 'basic' ? BASIC_STEPS : ADVANCED_STEPS;
}

/** Derives the guide's view of the user from GET /onboarding/status (feature 21 + 22 hints). */
export function buildGuideContext(status: OnboardingStatus | null, platform: GuidePlatform): GuideContext {
  const hints = status?.hints;
  const teamId = hints?.teamId ?? null;
  const activeSprintId = hints?.activeSprintId ?? null;
  const endedSprintId = hints?.endedSprintId ?? null;
  // No status (older server / failed load) is treated like a brand-new management user: only
  // steps that need no data are shown, and the demo board stands in for the real one.
  const isManagement = status ? status.track === 'MANAGEMENT' : true;
  const hasTeam = teamId !== null;
  return {
    platform,
    isManagement,
    hasTeam,
    canManage: isManagement && hasTeam,
    teamId,
    activeSprintId,
    endedSprintId,
    hasActiveSprint: hasTeam && activeSprintId !== null,
    hasEndedSprint: hasTeam && endedSprintId !== null,
  };
}

/** Steps that apply to this user on this platform, in script order. */
export function filterSteps(steps: GuideStep[], ctx: GuideContext): GuideStep[] {
  return steps.filter((s) => {
    if (s.audience === 'MANAGEMENT' && !ctx.isManagement) return false;
    if (s.platforms && !s.platforms.includes(ctx.platform)) return false;
    if (s.requires && !s.requires(ctx)) return false;
    return true;
  });
}
