import { sprintPath } from '@/lib/sprint-routes';
import type { GuideStep } from './guide-types';

// The advanced guide: settings and the features that are easy to miss.
export const ADVANCED_STEPS: GuideStep[] = [
  { id: 'adv-welcome', audience: 'ALL', advanceOn: { type: 'next' } },
  { id: 'settings-telegram', audience: 'ALL', route: () => '/settings', anchor: 'settings-telegram', advanceOn: { type: 'next' } },
  { id: 'settings-google', audience: 'ALL', route: () => '/settings', anchor: 'settings-google', advanceOn: { type: 'next' } },
  { id: 'settings-appearance', audience: 'ALL', route: () => '/settings', anchor: 'settings-appearance', advanceOn: { type: 'next' } },
  { id: 'adv-categories', audience: 'ALL', requires: (c) => c.hasActiveSprint, route: (c) => sprintPath(c.teamId!, c.activeSprintId!), anchor: 'board-category', advanceOn: { type: 'next' } },
  { id: 'adv-categories-info', audience: 'ALL', requires: (c) => !c.hasActiveSprint, route: () => '/', advanceOn: { type: 'next' } },
  { id: 'adv-logo', audience: 'MANAGEMENT', requires: (c) => c.canManage, route: () => '/', advanceOn: { type: 'next' } },
  { id: 'adv-phantom', audience: 'MANAGEMENT', requires: (c) => c.canManage, route: () => '/', advanceOn: { type: 'next' } },
  { id: 'adv-done', audience: 'ALL', route: () => '/', advanceOn: { type: 'next' } },
];
