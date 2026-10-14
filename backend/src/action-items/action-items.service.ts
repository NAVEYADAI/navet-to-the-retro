import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateActionItemDto, UpdateActionItemDto } from './dto/action-items.dto';
import {
  requireNonEmptyString,
  assertOptionalEnum,
  assertOptionalPositiveInt,
  parseExpiryInput
} from '../common/validation';
import { isDeleted } from '../common/soft-delete';

// Feature 16 (action items, product-backlog/16-action-items.md §16.1): follow-up commitments that
// close the retro loop. Same shape as team-categories.service.ts — a teamId-scoped resource where,
// per §16.0 decision #2, EVERY active member may do everything (no admin gate).
//
// Not subject to the retro board's write window (§16.0 technical default #5): an old task can be
// closed even when the board of the sprint it was born in is locked.
export const ACTION_ITEM_STATUSES = ['OPEN', 'DONE', 'DROPPED'] as const;
type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export const MAX_ACTION_ITEM_TITLE_LENGTH = 500;
const MAX_ASSIGNEES = 50;

const STATUS_ORDER: Record<ActionItemStatus, number> = { OPEN: 0, DONE: 1, DROPPED: 2 };

const ITEM_INCLUDE = {
  team: { select: { id: true, name: true } },
  sprint: { select: { id: true, name: true } },
  assignees: {
    include: { user: { select: { id: true, username: true, firstName: true, lastName: true } } },
    orderBy: { id: 'asc' as const }
  }
};

@Injectable()
export class ActionItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertIsActiveMember(teamId: number, requesterId: number) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not belong to this team');
    }
  }

  private parseStatusFilter(status: unknown): ActionItemStatus | undefined {
    if (status === undefined || status === null || status === '') return undefined;
    assertOptionalEnum(status, ACTION_ITEM_STATUSES, 'סטטוס לא תקין');
    return status as ActionItemStatus;
  }

  // `assigneeIds` must be a duplicate-free list of positive Int32s; duplicates are dropped
  // silently (the unique index would otherwise 500).
  private parseAssigneeIds(value: unknown): number[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('רשימת האחראים לא תקינה');
    }
    if (value.length > MAX_ASSIGNEES) {
      throw new BadRequestException('יותר מדי אחראים למשימה');
    }
    for (const id of value) {
      assertOptionalPositiveInt(id, 'מזהה אחראי לא תקין');
      if (id === undefined || id === null) {
        throw new BadRequestException('מזהה אחראי לא תקין');
      }
    }
    return Array.from(new Set(value as number[]));
  }

  // §16.0 technical default #3: a NEW assignee must be an ACTIVE member of the team right now.
  private async assertAssigneesAreActiveMembers(teamId: number, userIds: number[]) {
    if (userIds.length === 0) return;
    const members = await this.prisma.teamMember.findMany({
      where: { teamId, status: 'ACTIVE', userId: { in: userIds } },
      select: { userId: true }
    });
    if (members.length !== userIds.length) {
      throw new BadRequestException('ניתן לשייך משימה רק לחברי צוות פעילים');
    }
  }

  private parseTitle(value: unknown): string {
    const title = requireNonEmptyString(value, 'יש להזין כותרת למשימה').trim();
    if (title.length > MAX_ACTION_ITEM_TITLE_LENGTH) {
      throw new BadRequestException(`כותרת המשימה ארוכה מדי (עד ${MAX_ACTION_ITEM_TITLE_LENGTH} תווים)`);
    }
    return title;
  }

  // Date-only input ("2026-10-20") is the end of that day in Israel time — same convention as
  // invite expiry (BUG-32), so a task due "today" isn't instantly overdue. `null` clears it.
  private parseDueDate(value: unknown): Date | null {
    if (value === null) return null;
    return parseExpiryInput(value, 'תאריך היעד לא תקין');
  }

  // Adds `isActiveMember` per assignee (§16.0 technical default #3: someone who left the team or
  // deleted their account stays assigned and the UI shows "not in the team").
  private async shape<T extends { teamId: number; assignees: Array<{ userId: number }> }>(items: T[]) {
    const pairs = items.flatMap(item => item.assignees.map(a => ({ teamId: item.teamId, userId: a.userId })));
    const activeKeys = new Set<string>();
    if (pairs.length > 0) {
      const members = await this.prisma.teamMember.findMany({
        where: {
          status: 'ACTIVE',
          OR: pairs.map(p => ({ teamId: p.teamId, userId: p.userId }))
        },
        select: { teamId: true, userId: true }
      });
      for (const m of members) activeKeys.add(`${m.teamId}:${m.userId}`);
    }
    return items.map(item => ({
      ...item,
      assignees: item.assignees.map(a => ({
        ...a,
        isActiveMember: activeKeys.has(`${item.teamId}:${a.userId}`)
      }))
    }));
  }

  // Open first, then earliest due date (undated last), then oldest first.
  private sortItems<T extends { status: ActionItemStatus; dueDate: Date | null; createdAt: Date; id: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (a.dueDate && b.dueDate) {
        const diff = a.dueDate.getTime() - b.dueDate.getTime();
        if (diff !== 0) return diff;
      } else if (a.dueDate || b.dueDate) {
        return a.dueDate ? -1 : 1;
      }
      return a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id;
    });
  }

  async listForTeam(teamId: number, requesterId: number, status?: string) {
    const statusFilter = this.parseStatusFilter(status);
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team || isDeleted(team)) {
      throw new NotFoundException('Team not found');
    }
    await this.assertIsActiveMember(teamId, requesterId);

    const items = await this.prisma.actionItem.findMany({
      where: { teamId, ...(statusFilter ? { status: statusFilter } : {}) },
      include: ITEM_INCLUDE
    });
    return this.shape(this.sortItems(items));
  }

  // The dashboard's "my tasks": open items assigned to me, across all my live teams. A team I no
  // longer belong to (left / removed) drops out — I can't act on its items any more.
  async listMine(requesterId: number, status?: string) {
    const statusFilter = this.parseStatusFilter(status) ?? 'OPEN';
    const items = await this.prisma.actionItem.findMany({
      where: {
        status: statusFilter,
        assignees: { some: { userId: requesterId } },
        team: { deletedAt: null, members: { some: { userId: requesterId, status: 'ACTIVE' } } }
      },
      include: ITEM_INCLUDE
    });
    return this.shape(this.sortItems(items));
  }

  async create(sprintId: number, dto: CreateActionItemDto, requesterId: number) {
    // Explicit body validation first (the project has no ValidationPipe, see BUG-15).
    const title = this.parseTitle(dto?.title);
    assertOptionalPositiveInt(dto?.sourceCommentId, 'מזהה ההערה לא תקין');
    const assigneeIds = dto?.assigneeIds === undefined || dto.assigneeIds === null
      ? []
      : this.parseAssigneeIds(dto.assigneeIds);
    const dueDate = dto?.dueDate === undefined ? null : this.parseDueDate(dto.dueDate);

    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { team: { select: { deletedAt: true } } }
    });
    if (!sprint || isDeleted(sprint) || isDeleted(sprint.team)) {
      throw new NotFoundException('Sprint not found');
    }
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: sprint.teamId } }
    });
    // Same 404 as a missing sprint so a non-member can't enumerate sprint ids (BUG-40).
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Sprint not found');
    }

    // The source comment must belong to the same team. It does NOT have to be in this sprint.
    // The new item takes the comment's text from the client, never its author (§16.0 technical
    // default #4: an anonymous comment's writer is not exposed).
    if (dto.sourceCommentId !== undefined && dto.sourceCommentId !== null) {
      const comment = await this.prisma.comment.findFirst({
        where: { id: dto.sourceCommentId, teamId: sprint.teamId },
        select: { id: true }
      });
      if (!comment) {
        throw new BadRequestException('ההערה שנבחרה לא שייכת לצוות זה');
      }
    }

    await this.assertAssigneesAreActiveMembers(sprint.teamId, assigneeIds);

    const created = await this.prisma.actionItem.create({
      data: {
        teamId: sprint.teamId,
        sprintId,
        sourceCommentId: dto.sourceCommentId ?? null,
        title,
        dueDate,
        createdById: requesterId,
        assignees: { create: assigneeIds.map(userId => ({ userId })) }
      },
      include: ITEM_INCLUDE
    });
    return (await this.shape([created]))[0];
  }

  // A missing item and an item of a team the requester isn't in both answer 404, so ids can't be
  // enumerated across teams.
  private async loadForMember(id: number, requesterId: number) {
    const item = await this.prisma.actionItem.findUnique({
      where: { id },
      include: { team: { select: { deletedAt: true } }, assignees: true }
    });
    if (!item || isDeleted(item.team)) {
      throw new NotFoundException('Action item not found');
    }
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: item.teamId } }
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Action item not found');
    }
    return item;
  }

  async update(id: number, dto: UpdateActionItemDto, requesterId: number) {
    const touched =
      dto?.title !== undefined || dto?.status !== undefined ||
      dto?.assigneeIds !== undefined || dto?.dueDate !== undefined;
    if (!touched) {
      throw new BadRequestException('לא נשלח שום שינוי');
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = this.parseTitle(dto.title);
    if (dto.status !== undefined) {
      if (dto.status === null) throw new BadRequestException('סטטוס לא תקין');
      assertOptionalEnum(dto.status, ACTION_ITEM_STATUSES, 'סטטוס לא תקין');
    }
    if (dto.dueDate !== undefined) data.dueDate = this.parseDueDate(dto.dueDate);
    let assigneeIds: number[] | undefined;
    if (dto.assigneeIds !== undefined) {
      if (dto.assigneeIds === null) throw new BadRequestException('רשימת האחראים לא תקינה');
      assigneeIds = this.parseAssigneeIds(dto.assigneeIds);
    }

    const item = await this.loadForMember(id, requesterId);

    // `closedAt` marks the moment of closing: set on a move into DONE/DROPPED (including
    // DONE <-> DROPPED), cleared on reopen, untouched when the status doesn't change.
    if (dto.status !== undefined && dto.status !== item.status) {
      data.status = dto.status;
      data.closedAt = dto.status === 'OPEN' ? null : new Date();
    }

    if (assigneeIds) {
      // Only people being ADDED must be active members; someone already assigned who has since
      // left may stay (they're shown as "not in the team").
      const existing = new Set(item.assignees.map(a => a.userId));
      await this.assertAssigneesAreActiveMembers(item.teamId, assigneeIds.filter(uid => !existing.has(uid)));
    }

    const updated = await this.prisma.$transaction(async tx => {
      if (assigneeIds) {
        await tx.actionItemAssignee.deleteMany({
          where: { actionItemId: id, userId: { notIn: assigneeIds } }
        });
        const existing = new Set(item.assignees.map(a => a.userId));
        const toAdd = assigneeIds.filter(uid => !existing.has(uid));
        if (toAdd.length > 0) {
          await tx.actionItemAssignee.createMany({
            data: toAdd.map(userId => ({ actionItemId: id, userId })),
            skipDuplicates: true
          });
        }
      }
      return tx.actionItem.update({ where: { id }, data, include: ITEM_INCLUDE });
    });
    return (await this.shape([updated]))[0];
  }

  async remove(id: number, requesterId: number) {
    await this.loadForMember(id, requesterId);
    await this.prisma.actionItem.delete({ where: { id } });
    return { success: true };
  }
}
