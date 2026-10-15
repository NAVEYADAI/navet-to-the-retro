import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { logFocusEvent } from './focus-point-log';
import { PrismaService } from '../prisma.service';
import { CreateFocusPointTaskDto, UpdateFocusPointTaskDto } from './dto/focus-points.dto';
import { requireNonEmptyString, assertOptionalEnum, assertOptionalPositiveInt, parseExpiryInput } from '../common/validation';
import { isDeleted } from '../common/soft-delete';
import { assertManager } from './focus-point-access';
import { assertCanManageTeamContent } from '../teams/team-permissions.util';

const TASK_STATUSES = ['OPEN', 'DONE', 'DROPPED'] as const;
const MAX_TITLE_LENGTH = 500;

const TASK_INCLUDE = {
  assignee: { select: { id: true, username: true, firstName: true, lastName: true } },
  focusPoint: { select: { id: true, text: true, teamId: true, team: { select: { id: true, name: true } } } }
};

// Feature 20 §20.0 #3: tasks under an improvement point. Management (admin/team leader) creates
// and assigns them to a specific active member; the assignee can move their own task between
// statuses. The point's rating is unaffected by what happens to its tasks.
@Injectable()
export class FocusPointTasksService {
  private readonly logger = new Logger(FocusPointTasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  private parseTitle(value: unknown): string {
    const title = requireNonEmptyString(value, 'יש להזין כותרת למשימה').trim();
    if (title.length > MAX_TITLE_LENGTH) throw new BadRequestException(`כותרת המשימה ארוכה מדי (עד ${MAX_TITLE_LENGTH} תווים)`);
    return title;
  }

  private parseDue(value: unknown): Date | null {
    return value === null ? null : parseExpiryInput(value, 'תאריך היעד לא תקין');
  }

  private async assertAssignable(teamId: number, userId: number) {
    const member = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } }, include: { user: { select: { isPhantom: true } } }
    });
    if (!member || member.status !== 'ACTIVE' || member.user.isPhantom) {
      throw new BadRequestException('ניתן לשייך משימה רק לחבר צוות פעיל');
    }
  }

  async create(focusPointId: number, dto: CreateFocusPointTaskDto, requesterId: number) {
    const title = this.parseTitle(dto?.title);
    assertOptionalPositiveInt(dto?.assigneeId, 'מזהה האחראי לא תקין');
    const dueDate = dto?.dueDate === undefined ? null : this.parseDue(dto.dueDate);

    const point = await this.prisma.focusPoint.findUnique({ where: { id: focusPointId }, include: { team: { select: { deletedAt: true } } } });
    if (!point || isDeleted(point.team)) throw new NotFoundException('Focus point not found');
    await assertManager(this.prisma, point.teamId, requesterId);
    if (point.kind !== 'IMPROVE' || point.status === 'MERGED') throw new BadRequestException('אפשר להוסיף משימות רק לנקודת שיפור פעילה');
    if (dto.assigneeId) await this.assertAssignable(point.teamId, dto.assigneeId);

    const created = await this.prisma.focusPointTask.create({
      data: { focusPointId, title, assigneeId: dto.assigneeId ?? null, dueDate, createdById: requesterId },
      include: TASK_INCLUDE
    });
    logFocusEvent(this.logger, 'task_created', { teamId: point.teamId, pointId: focusPointId, taskId: created.id, assigned: !!dto.assigneeId, hasDue: !!dueDate, byManager: requesterId });
    return created;
  }

  async update(taskId: number, dto: UpdateFocusPointTaskDto, requesterId: number) {
    const task = await this.prisma.focusPointTask.findUnique({ where: { id: taskId }, include: { focusPoint: { include: { team: { select: { deletedAt: true } } } } } });
    if (!task || isDeleted(task.focusPoint.team)) throw new NotFoundException('Task not found');
    const teamId = task.focusPoint.teamId;
    const membership = await this.prisma.teamMember.findUnique({ where: { userId_teamId: { userId: requesterId, teamId } } });
    if (!membership || membership.status !== 'ACTIVE') throw new NotFoundException('Task not found');

    const touched = dto?.title !== undefined || dto?.assigneeId !== undefined || dto?.dueDate !== undefined || dto?.status !== undefined;
    if (!touched) throw new BadRequestException('לא נשלח שום שינוי');
    const isManager = membership.isAdmin || membership.role === 'TEAM_LEADER';
    const onlyStatus = dto.title === undefined && dto.assigneeId === undefined && dto.dueDate === undefined;
    if (!isManager && !(onlyStatus && task.assigneeId === requesterId)) {
      throw new ForbiddenException('רק מנהלי צוות וראשי צוותים, או האחראי על המשימה (לשינוי סטטוס), יכולים לעדכן אותה');
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = this.parseTitle(dto.title);
    if (dto.dueDate !== undefined) data.dueDate = this.parseDue(dto.dueDate);
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId !== null) {
        assertOptionalPositiveInt(dto.assigneeId, 'מזהה האחראי לא תקין');
        await this.assertAssignable(teamId, dto.assigneeId);
      }
      data.assigneeId = dto.assigneeId;
    }
    if (dto.status !== undefined) {
      if (dto.status === null) throw new BadRequestException('סטטוס לא תקין');
      assertOptionalEnum(dto.status, TASK_STATUSES, 'סטטוס לא תקין');
      if (dto.status !== task.status) {
        data.status = dto.status;
        data.closedAt = dto.status === 'OPEN' ? null : new Date();
      }
    }
    const updated = await this.prisma.focusPointTask.update({ where: { id: taskId }, data, include: TASK_INCLUDE });
    logFocusEvent(this.logger, 'task_updated', { teamId, taskId, status: (data.status as string) ?? undefined, reassigned: data.assigneeId !== undefined, byAssignee: !isManager });
    return updated;
  }

  async remove(taskId: number, requesterId: number) {
    const task = await this.prisma.focusPointTask.findUnique({ where: { id: taskId }, include: { focusPoint: { include: { team: { select: { deletedAt: true } } } } } });
    if (!task || isDeleted(task.focusPoint.team)) throw new NotFoundException('Task not found');
    await assertCanManageTeamContent(this.prisma, task.focusPoint.teamId, requesterId);
    await this.prisma.focusPointTask.delete({ where: { id: taskId } });
    logFocusEvent(this.logger, 'task_deleted', { teamId: task.focusPoint.teamId, taskId, byManager: requesterId });
    return { success: true };
  }

  // The dashboard's "המשימות שלי": my open tasks across the teams I'm still an active member of.
  async listMine(requesterId: number, status?: string) {
    if (status !== undefined && status !== '') assertOptionalEnum(status, TASK_STATUSES, 'סטטוס לא תקין');
    return this.prisma.focusPointTask.findMany({
      where: {
        assigneeId: requesterId,
        status: (status || 'OPEN') as 'OPEN' | 'DONE' | 'DROPPED',
        focusPoint: { status: { not: 'MERGED' }, team: { deletedAt: null, members: { some: { userId: requesterId, status: 'ACTIVE' } } } }
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      include: TASK_INCLUDE
    });
  }
}
