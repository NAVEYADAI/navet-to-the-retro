import { formatUserDisplayName } from './comment-display';
import type { CategoryOption } from './comment-types';

/**
 * Feature 13 — who an admin can open the board to: the team's real, active members (phantoms cannot
 * log in, pending invitations are not members yet). The admin themself is included — they may need to
 * write on an old sprint too.
 */
export function extensionMemberOptions(members: any[] | undefined): CategoryOption[] {
  return (members || [])
    .filter((m) => m?.status !== 'PENDING' && m?.user?.isPhantom !== true && m?.userId != null)
    .map((m) => ({
      value: String(m.userId),
      label: m.user ? formatUserDisplayName(m.user) : String(m.userId),
    }));
}
