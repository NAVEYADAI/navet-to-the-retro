import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprints.dto';
import { buildSprintSummaryPptx, buildExportFileName, resolveTemplateId } from './sprint-summary.builder';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { assertCanManageTeamContent } from '../teams/team-permissions.util';
import { requireNonEmptyString, assertOptionalString, parseDateString } from '../common/validation';

// BUG-12: a sprint must not end before it starts. Equal dates (a one-day sprint) are allowed.
// Unparseable dates are rejected here too, otherwise `NaN` comparisons would silently pass and
// Prisma would throw an uncaught 500. Overlap between sprints is deliberately NOT checked here.
function assertValidDateRange(startDate: Date, endDate: Date) {
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new BadRequestException('תאריך לא תקין');
  }
  if (endDate.getTime() < startDate.getTime()) {
    throw new BadRequestException('תאריך הסיום לא יכול להיות לפני תאריך ההתחלה');
  }
}

@Injectable()
export class SprintsService {
  private readonly logger = new Logger(SprintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarService: GoogleCalendarService
  ) {}

  async create(teamId: number, dto: CreateSprintDto, requesterId: number) {
    // BUG-15: validate the body before touching the DB — name required & non-blank, both dates
    // must be parseable date strings (a missing/garbled date used to reach Prisma as a 500).
    requireNonEmptyString(dto?.name, 'שם הספרינט הוא שדה חובה');
    assertOptionalString(dto.description, 'תיאור הספרינט לא תקין');
    const startDate = parseDateString(dto.startDate);
    const endDate = parseDateString(dto.endDate);

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

    // 2b. BUG-12: reject end-before-start before touching the DB.
    assertValidDateRange(startDate, endDate);

    // 3. Create the sprint, plus its baseline SprintLengthChange row (product-backlog/
    // 05-sprint-length-audit-log.md §5.0 decision #4) in the same transaction — the history for
    // a sprint always starts with a "row zero" of who created it and with what dates, never
    // empty until the first edit.
    const sprint = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sprint.create({
        data: {
          name: dto.name,
          description: dto.description,
          startDate,
          endDate,
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
    // BUG-15: a provided field must be well-formed (undefined = leave unchanged). An explicitly
    // provided name can't be blank; provided dates must parse — checked before the transaction
    // so a bad body never takes the row lock.
    if (dto?.name !== undefined) {
      requireNonEmptyString(dto.name, 'שם הספרינט לא יכול להיות ריק');
    }
    assertOptionalString(dto.description, 'תיאור הספרינט לא תקין');
    assertOptionalString(dto.reason, 'סיבת השינוי לא תקינה');
    const parsedStart = dto.startDate !== undefined ? parseDateString(dto.startDate) : undefined;
    const parsedEnd = dto.endDate !== undefined ? parseDateString(dto.endDate) : undefined;

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
    //
    // BUG-16: the "previous" dates are read INSIDE the transaction, under a row lock
    // (`SELECT ... FOR UPDATE`), so concurrent PATCHes on the same sprint serialize: each one
    // sees the value the previous one committed, and the audit chain
    // (previous -> new -> previous -> new ...) stays unbroken. BUG-12's merged-range check also
    // runs against these locked values, so it can't be bypassed by a racing update either.
    const { updated, datesChanged } = await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<{ startDate: Date; endDate: Date }[]>`
        SELECT "startDate", "endDate" FROM "Sprint" WHERE "id" = ${sprintId} FOR UPDATE
      `;
      const current = lockedRows[0];
      if (!current) {
        throw new NotFoundException('Sprint not found');
      }

      const newStart = parsedStart ?? current.startDate;
      const newEnd = parsedEnd ?? current.endDate;
      if (dto.startDate !== undefined || dto.endDate !== undefined) {
        assertValidDateRange(newStart, newEnd);
      }

      const result = await tx.sprint.update({
        where: { id: sprintId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.startDate !== undefined && { startDate: newStart }),
          ...(dto.endDate !== undefined && { endDate: newEnd })
        }
      });

      const changed =
        result.startDate.getTime() !== current.startDate.getTime() ||
        result.endDate.getTime() !== current.endDate.getTime();

      if (changed) {
        await tx.sprintLengthChange.create({
          data: {
            sprintId: result.id,
            changedById: requesterId,
            previousStartDate: current.startDate,
            previousEndDate: current.endDate,
            newStartDate: result.startDate,
            newEndDate: result.endDate,
            reason: dto.reason ?? null
          }
        });
      }

      return { updated: result, datesChanged: changed };
    });

    // 5. If the dates OR the name actually changed (BUG-52: a rename used to never reach Google),
    // patch the existing Google Calendar event(s) for this
    // sprint (product-backlog/06-google-calendar-integration.md §6.0.4) rather than deleting/recreating — best-effort, same
    // pattern as `create` above. Deliberately outside the `$transaction` above (external HTTP
    // call, not a DB write — see feature 5's cross-feature note).
    const nameChanged = updated.name !== sprint.name;
    if (datesChanged || nameChanged) {
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
    // BUG-40: permission first, existence second — otherwise a caller without access could tell
    // which sprint ids exist (404) from which don't (403).
    await assertCanManageTeamContent(this.prisma, teamId, requesterId);

    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, teamId } });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const records = await this.prisma.sprintLengthChange.findMany({
      where: { sprintId },
      orderBy: { createdAt: 'desc' },
      // BUG-17: whitelist the editor's public fields only — never `include: { changedBy: true }`,
      // which leaked email/googleId/emailVerifiedAt/global role (everything but password).
      include: { changedBy: { select: { id: true, firstName: true, lastName: true, username: true } } }
    });

    return records;
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
    // BUG-14: either way the requester must still be an ACTIVE member — the creator no longer
    // bypasses the membership check, so a creator who was removed from the team gets 403.
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!membership || membership.status !== 'ACTIVE' || (team.creatorId !== requesterId && !membership.isAdmin)) {
      throw new ForbiddenException('רק מי שיצר את הצוות או מנהל צוות יכולים לייצא סיכום ספרינט');
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
