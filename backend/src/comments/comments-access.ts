import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { isDeleted } from '../common/soft-delete';
import { isWithinWriteWindow } from '../sprints/sprint-write-window.util';

// Feature 13: lookups shared by CommentsService and SprintWriteExtensionsService.

/**
 * A live sprint (not deleted, team not deleted) plus the requester's ACTIVE membership of its team.
 * A missing/deleted sprint and a non-member look identical — 404 (BUG-40, no id enumeration).
 */
export async function loadSprintForMember(prisma: PrismaService, sprintId: number, requesterId: number) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { team: { select: { deletedAt: true } } }
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

/** The user's latest still-active write extension on this sprint, or null. */
export async function findActiveExtension(prisma: PrismaService, sprintId: number, userId: number, now: Date) {
  return prisma.sprintWriteExtension.findFirst({
    where: { sprintId, userId, expiresAt: { gt: now } },
    orderBy: { expiresAt: 'desc' }
  });
}

/**
 * May `userId` write/edit/delete own comments on this sprint right now? The common window is checked
 * first (pure, no query); the extension lookup only happens once the board is locked.
 */
export async function isSprintWritableFor(
  prisma: PrismaService,
  sprint: { id: number; endDate: Date },
  userId: number,
  now: Date = new Date()
): Promise<boolean> {
  if (isWithinWriteWindow(sprint, now)) return true;
  return (await findActiveExtension(prisma, sprint.id, userId, now)) !== null;
}

export const ANONYMOUS_LOCKED_MESSAGE =
  'אי אפשר לפרסם הערה אנונימית אחרי שהלוח ננעל — מועד הפרסום היה חושף מי כתב אותה';

export const ANONYMOUS_LOCKED_EDIT_MESSAGE =
  'אי אפשר לערוך או למחוק הערה אנונימית אחרי שהלוח ננעל — מועד הפעולה היה חושף מי כתב אותה';

/**
 * Whether a NEW anonymous comment may be written. Anonymous notes are allowed only inside the
 * common write window: once the board is locked, a member who can still write only thanks to an
 * admin's write extension would be identifiable from the timestamp (everyone else is locked out),
 * so the extension covers named comments only.
 */
export function isAnonymousAllowed(windowOpen: boolean): boolean {
  return windowOpen;
}
