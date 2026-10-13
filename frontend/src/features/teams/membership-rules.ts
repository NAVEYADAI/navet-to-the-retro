import { memberDisplayName } from './member-display';

/**
 * Feature 11 (product-backlog/11-team-leave-and-removal.md) — the same membership rules the backend
 * enforces in `teams.service.ts::removeMember`/`leaveTeam`, mirrored here only to decide what to
 * show. The server stays the source of truth.
 */

// `status` defaults to ACTIVE server-side (`TeamMemberStatus @default(ACTIVE)`) — treat a missing one the same.
export const isActiveMember = (m: any) => !!m && (m.status ?? 'ACTIVE') === 'ACTIVE';
const isActive = isActiveMember;
const isRealActive = (m: any) => isActive(m) && m.user?.isPhantom !== true;

/** Neither an admin nor a team leader (phantoms included) — all a non-admin team leader may remove. */
export function isRegularMember(member: any): boolean {
  return !member.isAdmin && member.role !== 'TEAM_LEADER';
}

export function canRemoveMember(me: any, target: any): boolean {
  if (!me || !isActive(me) || me.id === target.id) return false;
  if (me.isAdmin) return true;
  return me.role === 'TEAM_LEADER' && isRegularMember(target);
}

export function isLastActiveAdmin(members: any[], member: any): boolean {
  return member.isAdmin && isActive(member) && members.filter((m) => m.isAdmin && isActive(m)).length <= 1;
}

export function isLastActiveLeader(members: any[], member: any): boolean {
  return member.role === 'TEAM_LEADER' && isActive(member)
    && members.filter((m) => m.role === 'TEAM_LEADER' && isActive(m)).length <= 1;
}

export function isLastRealMember(members: any[], member: any): boolean {
  return !members.some((m) => m.id !== member.id && isRealActive(m));
}

/** Who can take over admin / team leader from `leaving`: ACTIVE, signed-up (not phantom), not them. */
export function getSuccessorOptions(members: any[], leaving: any): { value: string; label: string }[] {
  return members
    .filter((m) => m.id !== leaving.id && isRealActive(m))
    .map((m) => ({ value: String(m.id), label: memberDisplayName(m) }));
}
