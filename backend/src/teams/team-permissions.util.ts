import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Shared by any feature that lets "team admins and team leads" manage something for their team
// (comment highlighting, team-comment-categories) — see product-backlog/02-comment-highlighting.md §2.0/§3.0. `role` is
// otherwise a free-text job title any admin can change (see teams.service.ts::addMember), but
// these two features deliberately trust `TEAM_LEADER` as a permission signal alongside `isAdmin`.
export async function assertCanManageTeamContent(prisma: PrismaService, teamId: number, requesterId: number) {
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: requesterId, teamId } }
  });
  // BUG-04: a still-PENDING invitee has not accepted yet, so holds no permissions at all.
  if (!membership || membership.status !== 'ACTIVE' || (!membership.isAdmin && membership.role !== 'TEAM_LEADER')) {
    throw new ForbiddenException('רק מנהלי צוות וראשי צוותים יכולים לבצע פעולה זו');
  }
}

// Feature 11 (product-backlog/11-team-leave-and-removal.md §11.0 decision #1): a "regular" member is
// neither an admin nor a team leader (phantoms included). It's the only kind of member a
// non-admin TEAM_LEADER may remove — removing an admin or another team leader stays admin-only.
export function isRegularMember(member: { isAdmin: boolean; role: string }): boolean {
  return !member.isAdmin && member.role !== 'TEAM_LEADER';
}

export function assertCanRemoveMember(
  requester: { isAdmin: boolean; role: string; status: string } | null,
  target: { isAdmin: boolean; role: string }
) {
  if (!requester || requester.status !== 'ACTIVE') {
    throw new ForbiddenException('Only team admins can remove members');
  }
  if (requester.isAdmin) return;
  if (requester.role === 'TEAM_LEADER' && isRegularMember(target)) return;
  throw new ForbiddenException(
    requester.role === 'TEAM_LEADER'
      ? 'ראש צוות יכול להסיר רק חברים שאינם מנהלים או ראשי צוות'
      : 'Only team admins can remove members'
  );
}
