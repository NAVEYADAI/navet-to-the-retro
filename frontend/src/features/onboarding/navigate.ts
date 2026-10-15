import { router } from 'expo-router';
import { openFocusPoints } from '@/lib/sprint-routes';
import type { CtaKind } from './types';

/** Runs a step / feature call-to-action. `focus-points` needs the managed team's id; without one it's a no-op. */
export function performCta(cta: CtaKind, managedTeamId: number | null): void {
  if (cta === 'settings') router.push('/settings');
  else if (cta === 'focus-points' && managedTeamId !== null) openFocusPoints(managedTeamId);
}
