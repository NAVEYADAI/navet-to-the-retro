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
  if (!membership || (!membership.isAdmin && membership.role !== 'TEAM_LEADER')) {
    throw new ForbiddenException('רק מנהלי צוות וראשי צוותים יכולים לבצע פעולה זו');
  }
}
