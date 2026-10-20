import { openFocusPointsPath } from './guide-routes';
import { sprintPath } from '@/lib/sprint-routes';
import type { GuideStep } from './guide-types';

// The basic guide: the main flow, on the real screens. Order matters. A step with `requires` is
// dropped when the user's data doesn't fit (e.g. board steps need an active sprint; without one the
// demo-board steps take their place).
export const BASIC_STEPS: GuideStep[] = [
  { id: 'welcome', audience: 'ALL', advanceOn: { type: 'next' } },

  // No team yet: the way in is "צוות חדש" → settings.
  { id: 'new-team', audience: 'MANAGEMENT', platforms: ['web'], requires: (c) => !c.hasTeam, route: () => '/', anchor: 'dash-new-team', advanceOn: { type: 'press' } },
  { id: 'create-team-form', audience: 'MANAGEMENT', requires: (c) => !c.hasTeam, route: (c) => (c.platform === 'web' ? '/settings' : '/'), anchor: 'create-team-form', advanceOn: { type: 'next' } },

  // Team card.
  { id: 'members-toggle', audience: 'ALL', requires: (c) => c.hasTeam, route: () => '/', anchor: 'team-members-toggle', advanceOn: { type: 'press' } },
  { id: 'add-member', audience: 'MANAGEMENT', platforms: ['web'], requires: (c) => c.canManage, route: () => '/', anchor: 'team-add-member', advanceOn: { type: 'press' } },
  { id: 'add-member-modal', audience: 'MANAGEMENT', platforms: ['web'], requires: (c) => c.canManage, anchor: 'add-member-modal', advanceOn: { type: 'next' } },
  { id: 'add-member-close', audience: 'MANAGEMENT', platforms: ['web'], requires: (c) => c.canManage, anchor: 'add-member-close', advanceOn: { type: 'press' } },
  // Native: the add-member sheet is a system modal that would cover the highlight, so it is explained, not opened.
  { id: 'add-member-native', audience: 'MANAGEMENT', platforms: ['native'], requires: (c) => c.canManage, route: () => '/', anchor: 'team-add-member', advanceOn: { type: 'next' } },
  { id: 'sprint-new', audience: 'MANAGEMENT', requires: (c) => c.canManage, route: () => '/', anchor: 'sprint-new', advanceOn: { type: 'next' } },

  // The retro board — real when there is an active sprint, a client-side demo otherwise.
  { id: 'board-write', audience: 'ALL', requires: (c) => c.hasActiveSprint, route: (c) => sprintPath(c.teamId!, c.activeSprintId!), anchor: 'board-compose', advanceOn: { type: 'signal', name: 'comment-posted' } },
  { id: 'board-comments', audience: 'ALL', requires: (c) => c.hasActiveSprint, anchor: 'board-comments', advanceOn: { type: 'next' } },
  { id: 'board-demo-write', audience: 'ALL', requires: (c) => !c.hasActiveSprint, demo: true, anchor: 'demo-compose', advanceOn: { type: 'signal', name: 'comment-posted' } },
  { id: 'board-demo-comments', audience: 'ALL', requires: (c) => !c.hasActiveSprint, demo: true, anchor: 'demo-comments', advanceOn: { type: 'next' } },

  // Summary + PPTX.
  { id: 'summary', audience: 'ALL', requires: (c) => c.hasEndedSprint, route: (c) => sprintPath(c.teamId!, c.endedSprintId!, 'summary'), anchor: 'summary-download', advanceOn: { type: 'next' } },
  { id: 'summary-info', audience: 'ALL', requires: (c) => !c.hasEndedSprint, route: () => '/', advanceOn: { type: 'next' } },

  { id: 'focus-points', audience: 'MANAGEMENT', requires: (c) => c.canManage, route: (c) => openFocusPointsPath(c.teamId!), anchor: 'focus-new', advanceOn: { type: 'next' } },

  { id: 'done', audience: 'ALL', route: () => '/', advanceOn: { type: 'next' } },
];
