import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { assertCanManageTeamContent } from '../teams/team-permissions.util';
import { isDeleted } from '../common/soft-delete';

// Feature 20: shared lookups + permission gates for the focus-points services.

/** The management gate (§20.0 #5): `isAdmin` or `TEAM_LEADER`, ACTIVE — either one is enough. */
export async function assertManager(prisma: PrismaService, teamId: number, requesterId: number) {
  await assertCanManageTeamContent(prisma, teamId, requesterId);
}

export async function loadLiveTeam(prisma: PrismaService, teamId: number) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || isDeleted(team)) {
    throw new NotFoundException('Team not found');
  }
  return team;
}

/** A sprint of a live team, or 404 (a missing/deleted sprint and a non-member look the same — BUG-40). */
export async function loadSprintForMember(prisma: PrismaService, sprintId: number, requesterId: number) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { team: { select: { deletedAt: true, focusPointQuota: true } } }
  });
  if (!sprint || isDeleted(sprint) || isDeleted(sprint.team)) {
    throw new NotFoundException('Sprint not found');
  }
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: requesterId, teamId: sprint.teamId } }
  });
  if (!membership || membership.status !== 'ACTIVE') {
    throw new NotFoundException('Sprint not found');
  }
  return { sprint, membership };
}

/** ACTIVE, non-phantom members: the people who can rate, and the ones that count for anonymity (#14, #19). */
export function countActiveHumanMembers(prisma: Pick<PrismaService, 'teamMember'>, teamId: number) {
  return prisma.teamMember.count({ where: { teamId, status: 'ACTIVE', user: { isPhantom: false } } });
}

/** A sprint's rating window opens once its last day is over (`endDate` is stored as a date, so use its end). */
export function sprintEndsAt(sprint: { endDate: Date }): Date {
  const d = sprint.endDate;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function forbidden(message: string): never {
  throw new ForbiddenException(message);
}
