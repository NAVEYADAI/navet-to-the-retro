import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWriteExtensionDto } from './dto/comments.dto';
import { loadSprintForMember, findActiveExtension, isAnonymousAllowed } from './comments-access';
import { isWithinWriteWindow, WRITE_WINDOW_DAYS } from '../sprints/sprint-write-window.util';
import { parseExpiryInput, INT32_MAX } from '../common/validation';
import { israelDayAnchor } from '../common/israel-day';

// An extension is a temporary exception, not a permanent unlock: cap how far ahead it can be set
// (calendar days from today, Israel time).
export const MAX_EXTENSION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const USER_SELECT = { id: true, username: true, firstName: true, lastName: true } as const;

// Feature 13 §13.0 decision #2 / technical default #7: an admin opens the write window of one
// sprint for one member until `expiresAt`, and may revoke it earlier.
@Injectable()
export class SprintWriteExtensionsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(membership: { isAdmin: boolean }, message: string) {
    // Admin only — not a team leader (§13.0 decision #5 applies the same gate to moderation).
    if (membership.isAdmin !== true) {
      throw new ForbiddenException(message);
    }
  }

  // One extension per (sprint, member): granting again replaces the previous one (so an admin can
  // both extend and shorten it).
  async grant(sprintId: number, dto: CreateWriteExtensionDto, requesterId: number) {
    const { sprint, membership } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    this.assertAdmin(membership, 'רק מנהל צוות יכול להאריך חלון כתיבה');

    if (
      typeof dto?.userId !== 'number' || !Number.isInteger(dto.userId) || dto.userId < 1 || dto.userId > INT32_MAX
    ) {
      throw new BadRequestException('מזהה המשתמש לא תקין');
    }
    const expiresAt = parseExpiryInput(dto.expiresAt, 'תאריך סיום ההארכה לא תקין');
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('תאריך סיום ההארכה חייב להיות בעתיד');
    }
    // The latest allowed moment is the END of the Israeli calendar day 30 days from today, so a date
    // picker value "today + 30 days" (date-only = end of that day) is accepted.
    const lastDay = new Date(israelDayAnchor().getTime() + MAX_EXTENSION_DAYS * MS_PER_DAY);
    const latestAllowed = parseExpiryInput(lastDay.toISOString().slice(0, 10));
    if (expiresAt.getTime() > latestAllowed.getTime()) {
      throw new BadRequestException(`אפשר להאריך את חלון הכתיבה עד ${MAX_EXTENSION_DAYS} ימים קדימה בלבד`);
    }

    const target = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: dto.userId, teamId: sprint.teamId } }
    });
    if (!target || target.status !== 'ACTIVE') {
      throw new NotFoundException('Team member not found in this team');
    }

    // @@unique([sprintId, userId]) makes this atomic: two concurrent grants can no longer leave two rows.
    return this.prisma.sprintWriteExtension.upsert({
      where: { sprintId_userId: { sprintId, userId: dto.userId } },
      create: { sprintId, userId: dto.userId, grantedById: requesterId, expiresAt },
      update: { grantedById: requesterId, expiresAt, createdAt: new Date() },
      include: { user: { select: USER_SELECT } }
    });
  }

  async revoke(sprintId: number, extensionId: number, requesterId: number) {
    const { membership } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    this.assertAdmin(membership, 'רק מנהל צוות יכול לבטל הארכת כתיבה');

    const extension = await this.prisma.sprintWriteExtension.findFirst({ where: { id: extensionId, sprintId } });
    if (!extension) {
      throw new NotFoundException('Write extension not found');
    }
    await this.prisma.sprintWriteExtension.delete({ where: { id: extensionId } });
    return { success: true };
  }

  // Active (not yet expired) extensions of the sprint: an admin sees all of them (to revoke), any
  // other member sees only their own.
  async list(sprintId: number, requesterId: number) {
    const { membership } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    return this.prisma.sprintWriteExtension.findMany({
      where: {
        sprintId,
        expiresAt: { gt: new Date() },
        ...(membership.isAdmin === true ? {} : { userId: requesterId })
      },
      orderBy: { expiresAt: 'asc' },
      include: { user: { select: USER_SELECT } }
    });
  }

  // What the board needs to decide between the write form and the "locked" notice.
  async getAccess(sprintId: number, requesterId: number) {
    const { sprint } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    const now = new Date();
    const windowOpen = isWithinWriteWindow(sprint, now);
    const extension = await findActiveExtension(this.prisma, sprintId, requesterId, now);
    return {
      canWrite: windowOpen || extension !== null,
      windowOpen,
      windowDays: WRITE_WINDOW_DAYS,
      extensionExpiresAt: extension?.expiresAt ?? null,
      // False once the board is locked and writing relies on an extension: an anonymous note would be
      // identifiable by its timestamp, so the server rejects it (comments.service.ts::create).
      anonymousAllowed: isAnonymousAllowed(windowOpen)
    };
  }
}
