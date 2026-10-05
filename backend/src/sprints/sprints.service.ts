import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprints.dto';
import { buildSprintSummaryPptx, buildExportFileName, resolveTemplateId } from './sprint-summary.builder';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { assertCanManageTeamContent } from '../teams/team-permissions.util';

@Injectable()
export class SprintsService {
  private readonly logger = new Logger(SprintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarService: GoogleCalendarService
  ) {}

  async create(teamId: number, dto: CreateSprintDto, requesterId: number) {
    // 1. Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.status !== 'ACTIVE') {
      throw new ConflictException('לא ניתן ליצור ספרינטים לצוות שטרם אושר');
    }

    // 2. Verify requester is a team admin
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: teamId
        }
      }
    });
    if (!requesterMembership || requesterMembership.status !== 'ACTIVE' || !requesterMembership.isAdmin) {
      throw new ForbiddenException('Only team admins can create sprints');
    }

    // 3. Create the sprint, plus its baseline SprintLengthChange row (product-backlog/
    // 05-sprint-length-audit-log.md §5.0 decision #4) in the same transaction — the history for
    // a sprint always starts with a "row zero" of who created it and with what dates, never
    // empty until the first edit.
    const sprint = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sprint.create({
        data: {
          name: dto.name,
          description: dto.description,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          teamId: teamId
        }
      });

      await tx.sprintLengthChange.create({
        data: {
          sprintId: created.id,
          changedById: requesterId,
          previousStartDate: null,
          previousEndDate: null,
          newStartDate: created.startDate,
          newEndDate: created.endDate,
          reason: null
        }
      });

      return created;
    });

    // 4. Best-effort sync to every team member's connected Google Calendar
    // (product-backlog/06-google-calendar-integration.md §6) — never blocks/fails sprint creation, same external-service pattern as EmailService.
    try {
      await this.googleCalendarService.syncSprintCreated({
        sprintId: sprint.id,
        teamId,
        name: sprint.name,
        teamName: team.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate
      });
    } catch (err) {
      this.logger.warn(`Google Calendar sync failed for newly created sprint ${sprint.id}`, err instanceof Error ? err.stack : err);
    }

    return sprint;
  }

  async update(teamId: number, sprintId: number, dto: UpdateSprintDto, requesterId: number) {
    // 1. Verify team exists
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // 2. Verify requester is a team admin — same permission as creating a sprint, so no one
    // can edit a sprint they couldn't have created in the first place.
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!requesterMembership || requesterMembership.status !== 'ACTIVE' || !requesterMembership.isAdmin) {
      throw new ForbiddenException('Only team admins can edit sprints');
    }

    // 3. Verify the sprint exists and belongs to this team
    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, teamId } });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // 4. Update only the fields actually provided, plus (product-backlog/
    // 05-sprint-length-audit-log.md §5.1) a SprintLengthChange row if the dates actually
    // changed — both writes share one `$transaction` so a history row is never created without
    // the update itself succeeding, or vice versa. `datesChanged` here is the single source of
    // truth reused below for the (non-transactional) Google Calendar sync decision, per feature
    // 5's cross-feature note — not recomputed a second time.
    const { updated, datesChanged } = await this.prisma.$transaction(async (tx) => {
      const result = await tx.sprint.update({
        where: { id: sprintId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
          ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) })
        }
      });

      const changed =
        result.startDate.getTime() !== sprint.startDate.getTime() ||
        result.endDate.getTime() !== sprint.endDate.getTime();

      if (changed) {
        await tx.sprintLengthChange.create({
          data: {
            sprintId: result.id,
            changedById: requesterId,
            previousStartDate: sprint.startDate,
            previousEndDate: sprint.endDate,
            newStartDate: result.startDate,
            newEndDate: result.endDate,
            reason: dto.reason ?? null
          }
        });
      }

      return { updated: result, datesChanged: changed };
    });

    // 5. If the dates actually changed, patch the existing Google Calendar event(s) for this
    // sprint (product-backlog/06-google-calendar-integration.md §6.0.4) rather than deleting/recreating — best-effort, same
    // pattern as `create` above. Deliberately outside the `$transaction` above (external HTTP
    // call, not a DB write — see feature 5's cross-feature note).
    if (datesChanged) {
      try {
        await this.googleCalendarService.syncSprintUpdated({
          sprintId: updated.id,
          teamId,
          name: updated.name,
          teamName: team.name,
          startDate: updated.startDate,
          endDate: updated.endDate
        });
      } catch (err) {
        this.logger.warn(`Google Calendar sync failed for updated sprint ${updated.id}`, err instanceof Error ? err.stack : err);
      }
    }

    return updated;
  }

  // Feature 5 (product-backlog/05-sprint-length-audit-log.md §5.1): read-only history of a
  // sprint's startDate/endDate changes, gated by `assertCanManageTeamContent` (admin or
  // TEAM_LEADER — a *viewing* permission, deliberately broader than the admin-only write path
  // above, see §5.0 decision #2 there).
  async getLengthHistory(teamId: number, sprintId: number, requesterId: number) {
    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, teamId } });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    await assertCanManageTeamContent(this.prisma, teamId, requesterId);

    const records = await this.prisma.sprintLengthChange.findMany({
      where: { sprintId },
      orderBy: { createdAt: 'desc' },
      include: { changedBy: true }
    });

    // Every User-shaped response strips `password` manually — no @Exclude in this codebase
    // (see backend/AGENTS.md §"Passwords & JWT").
    return records.map(({ changedBy, ...record }) => {
      const { password, ...safeChangedBy } = changedBy;
      return { ...record, changedBy: safeChangedBy };
    });
  }

  async findAll(teamId: number, requesterId: number) {
    // 1. Verify requester is a member of this team
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: teamId
        }
      }
    });
    if (!requesterMembership || requesterMembership.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not belong to this team');
    }

    // 2. Get sprints ordered by start date desc
    return this.prisma.sprint.findMany({
      where: { teamId: teamId },
      orderBy: { startDate: 'desc' }
    });
  }

  async exportSummaryPptx(teamId: number, sprintId: number, requesterId: number, templateId?: string): Promise<{ buffer: Buffer; fileName: string }> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // The team's creator OR any team admin can export a sprint summary — see
    // product-backlog/01-sprint-summary-export.md §1.0 (updated 2026-09-01 per Nave: admins should also be able to).
    if (team.creatorId !== requesterId) {
      const membership = await this.prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: requesterId, teamId } }
      });
      if (!membership || membership.status !== 'ACTIVE' || !membership.isAdmin) {
        throw new ForbiddenException('רק מי שיצר את הצוות או מנהל צוות יכולים לייצא סיכום ספרינט');
      }
    }

    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, teamId } });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // Feature 3 (team comment categories): `category` is now a relation, not a flat enum column
    // — join the label directly so the builder never needs a separate categories lookup (same
    // reasoning as getCommentsForSprint below).
    const comments = await this.prisma.comment.findMany({
      where: { sprintId },
      select: { content: true, type: true, category: { select: { label: true } } }
    });

    const buffer = await buildSprintSummaryPptx({
      sprintName: sprint.name,
      teamName: team.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      comments: comments.map(c => ({ content: c.content, type: c.type, category: c.category?.label ?? null })),
      templateId: resolveTemplateId(templateId)
    });

    return { buffer, fileName: buildExportFileName(sprint.name) };
  }
}
