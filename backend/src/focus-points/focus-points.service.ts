import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { logFocusEvent } from './focus-point-log';
import { PrismaService } from '../prisma.service';
import {
  CreateFocusPointDto, UpdateFocusPointDto, MergeFocusPointDto, UpdateFocusPointSettingsDto
} from './dto/focus-points.dto';
import { requireNonEmptyString, assertOptionalEnum, INT32_MAX } from '../common/validation';
import { isDeleted } from '../common/soft-delete';
import { assertManager, loadLiveTeam, countActiveHumanMembers, sprintEndsAt } from './focus-point-access';
import { buildHistory, summarizeSprintRatings, SCORE_MIN, SCORE_MAX } from './focus-point-score';

export const MAX_POINT_TEXT_LENGTH = 500;
const MAX_SOURCES = 50;
const MAX_QUOTA = 10;
const MAX_WATCH_SPRINTS = 50;

// Feature 20 (product-backlog/20-issue-tracking.md §20.1): the management side of the pool —
// create / edit / merge points and read them with their scores. Only ratings whose sprint window is
// CLOSED reach a score, and no query here ever selects a rating's `userId` or `reason` (#15).
@Injectable()
export class FocusPointsService {
  private readonly logger = new Logger(FocusPointsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private parseText(value: unknown): string {
    const text = requireNonEmptyString(value, 'יש להזין טקסט לנקודה').trim();
    if (text.length > MAX_POINT_TEXT_LENGTH) {
      throw new BadRequestException(`טקסט הנקודה ארוך מדי (עד ${MAX_POINT_TEXT_LENGTH} תווים)`);
    }
    return text;
  }

  private parseIdList(value: unknown, message: string): number[] {
    if (!Array.isArray(value) || value.length > MAX_SOURCES) throw new BadRequestException(message);
    for (const id of value) {
      if (typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > INT32_MAX) throw new BadRequestException(message);
    }
    return Array.from(new Set(value as number[]));
  }

  private async assertCommentsInTeam(teamId: number, commentIds: number[]) {
    if (commentIds.length === 0) return;
    const found = await this.prisma.comment.count({ where: { id: { in: commentIds }, teamId } });
    if (found !== commentIds.length) {
      throw new BadRequestException('אחת ההערות שנבחרו לא שייכת לצוות זה');
    }
  }

  /** A point of a live team that is the requester's to manage, or 404/403. */
  private async loadManaged(id: number, requesterId: number) {
    const point = await this.prisma.focusPoint.findUnique({ where: { id }, include: { team: { select: { deletedAt: true } } } });
    if (!point || isDeleted(point.team)) {
      throw new NotFoundException('Focus point not found');
    }
    await assertManager(this.prisma, point.teamId, requesterId);
    return point;
  }

  async create(teamId: number, dto: CreateFocusPointDto, requesterId: number) {
    await loadLiveTeam(this.prisma, teamId);
    await assertManager(this.prisma, teamId, requesterId);

    assertOptionalEnum(dto?.kind, ['IMPROVE', 'KEEP'], 'סוג הנקודה לא תקין');
    if (!dto?.kind) throw new BadRequestException('יש לבחור סוג נקודה');
    const text = this.parseText(dto.text);
    let initialScore: number | null = null;
    if (dto.kind === 'IMPROVE') {
      if (typeof dto.initialScore !== 'number' || !Number.isInteger(dto.initialScore) || dto.initialScore < SCORE_MIN || dto.initialScore > SCORE_MAX) {
        throw new BadRequestException('יש לקבוע ציון פתיחה בין 1 ל-5');
      }
      initialScore = dto.initialScore;
    }
    const sourceIds = dto.sourceCommentIds === undefined ? [] : this.parseIdList(dto.sourceCommentIds, 'רשימת ההערות לא תקינה');
    await this.assertCommentsInTeam(teamId, sourceIds);

    return this.prisma.$transaction(async (tx) => {
      const point = await tx.focusPoint.create({
        data: {
          teamId, kind: dto.kind, text, initialScore, createdById: requesterId,
          versions: { create: { text, changedById: requesterId } },
          sources: { create: sourceIds.map((commentId) => ({ commentId })) }
        }
      });
      // Proposals on the comments it now covers are answered (the proposers see nothing, #6).
      if (sourceIds.length > 0) {
        await tx.focusPointProposal.updateMany({
          where: { commentId: { in: sourceIds }, status: 'PENDING' },
          data: { status: 'MERGED', focusPointId: point.id }
        });
      }
      return point;
    }).then((point) => {
      logFocusEvent(this.logger, 'created', { teamId, pointId: point.id, kind: dto.kind, sources: sourceIds.length, byManager: requesterId });
      return point;
    });
  }

  async update(id: number, dto: UpdateFocusPointDto, requesterId: number) {
    const point = await this.loadManaged(id, requesterId);
    if (point.status === 'MERGED') throw new ConflictException('הנקודה מוזגה לנקודה אחרת');
    const touched = dto?.text !== undefined || dto?.status !== undefined || dto?.watchSprintsLeft !== undefined || dto?.addSourceCommentIds !== undefined;
    if (!touched) throw new BadRequestException('לא נשלח שום שינוי');

    const data: Record<string, unknown> = {};
    let newText: string | null = null;
    if (dto.text !== undefined) {
      newText = this.parseText(dto.text);
      if (newText !== point.text) data.text = newText; else newText = null;
    }
    if (dto.status !== undefined) {
      assertOptionalEnum(dto.status, ['ACTIVE', 'ARCHIVED'], 'סטטוס לא תקין');
      if (!dto.status) throw new BadRequestException('סטטוס לא תקין');
      if (point.kind === 'KEEP') throw new BadRequestException('לנקודת שימור אין מחזור חיים');
      if (dto.status !== point.status) {
        data.status = dto.status;
        data.closedAt = null;
      }
    }
    if (dto.watchSprintsLeft !== undefined) {
      if (point.kind === 'KEEP') throw new BadRequestException('לנקודת שימור אין מחזור חיים');
      const w = dto.watchSprintsLeft;
      if (w !== null && (typeof w !== 'number' || !Number.isInteger(w) || w < 1 || w > MAX_WATCH_SPRINTS)) {
        throw new BadRequestException('מספר הספרינטים לא תקין');
      }
      data.watchSprintsLeft = w;
    }
    const addSources = dto.addSourceCommentIds === undefined ? [] : this.parseIdList(dto.addSourceCommentIds, 'רשימת ההערות לא תקינה');
    await this.assertCommentsInTeam(point.teamId, addSources);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.focusPoint.update({ where: { id }, data });
      if (newText) await tx.focusPointTextVersion.create({ data: { focusPointId: id, text: newText, changedById: requesterId } });
      if (addSources.length > 0) {
        await tx.focusPointSource.createMany({ data: addSources.map((commentId) => ({ focusPointId: id, commentId })), skipDuplicates: true });
        await tx.focusPointProposal.updateMany({
          where: { commentId: { in: addSources }, status: 'PENDING' },
          data: { status: 'MERGED', focusPointId: id }
        });
      }
    });
    logFocusEvent(this.logger, 'updated', {
      teamId: point.teamId, pointId: id, textChanged: !!newText, status: (data.status as string) ?? undefined,
      watchChanged: dto.watchSprintsLeft !== undefined, sourcesAdded: addSources.length, byManager: requesterId,
    });
    return this.prisma.focusPoint.findUnique({ where: { id } });
  }

  // §20.0 #7: merging keeps the target's identity. The source's comments, proposals, tasks and
  // (non-conflicting) sprint selections + their ratings move over; it stays as a hidden MERGED row.
  async merge(id: number, dto: MergeFocusPointDto, requesterId: number) {
    const source = await this.loadManaged(id, requesterId);
    if (typeof dto?.intoId !== 'number' || !Number.isInteger(dto.intoId) || dto.intoId < 1) {
      throw new BadRequestException('מזהה נקודת היעד לא תקין');
    }
    if (dto.intoId === id) throw new BadRequestException('אי אפשר למזג נקודה לעצמה');
    const target = await this.prisma.focusPoint.findUnique({ where: { id: dto.intoId } });
    if (!target || target.teamId !== source.teamId) throw new NotFoundException('Focus point not found');
    if (source.status === 'MERGED' || target.status === 'MERGED') throw new ConflictException('הנקודה כבר מוזגה');
    if (source.kind !== target.kind) throw new BadRequestException('אפשר למזג רק נקודות מאותו סוג');
    const newText = dto.text === undefined ? null : this.parseText(dto.text);

    await this.prisma.$transaction(async (tx) => {
      const sources = await tx.focusPointSource.findMany({ where: { focusPointId: id }, select: { commentId: true } });
      await tx.focusPointSource.createMany({ data: sources.map((s) => ({ focusPointId: target.id, commentId: s.commentId })), skipDuplicates: true });
      await tx.focusPointSource.deleteMany({ where: { focusPointId: id } });
      await tx.focusPointProposal.updateMany({ where: { focusPointId: id }, data: { focusPointId: target.id } });
      await tx.focusPointTask.updateMany({ where: { focusPointId: id }, data: { focusPointId: target.id } });

      const targetSprints = new Set((await tx.focusPointSprint.findMany({ where: { focusPointId: target.id }, select: { sprintId: true } })).map((s) => s.sprintId));
      for (const sel of await tx.focusPointSprint.findMany({ where: { focusPointId: id } })) {
        if (targetSprints.has(sel.sprintId)) {
          await tx.focusPointSprint.delete({ where: { id: sel.id } });
        } else {
          await tx.focusPointSprint.update({ where: { id: sel.id }, data: { focusPointId: target.id } });
          await tx.focusPointRating.updateMany({ where: { focusPointId: id, sprintId: sel.sprintId }, data: { focusPointId: target.id } });
        }
      }
      await tx.focusPoint.update({ where: { id }, data: { status: 'MERGED', mergedIntoId: target.id } });
      if (newText && newText !== target.text) {
        await tx.focusPoint.update({ where: { id: target.id }, data: { text: newText } });
        await tx.focusPointTextVersion.create({ data: { focusPointId: target.id, text: newText, changedById: requesterId } });
      }
    });
    logFocusEvent(this.logger, 'merged', { teamId: source.teamId, pointId: id, intoId: target.id, textChanged: !!newText, byManager: requesterId });
    return { success: true, intoId: target.id };
  }

  async updateSettings(teamId: number, dto: UpdateFocusPointSettingsDto, requesterId: number) {
    await loadLiveTeam(this.prisma, teamId);
    await assertManager(this.prisma, teamId, requesterId);
    const quota = dto?.quota;
    if (typeof quota !== 'number' || !Number.isInteger(quota) || quota < 1 || quota > MAX_QUOTA) {
      throw new BadRequestException(`המכסה חייבת להיות מספר בין 1 ל-${MAX_QUOTA}`);
    }
    const team = await this.prisma.team.update({ where: { id: teamId }, data: { focusPointQuota: quota }, select: { focusPointQuota: true } });
    logFocusEvent(this.logger, 'quota_changed', { teamId, quota: team.focusPointQuota, byManager: requesterId });
    return { quota: team.focusPointQuota };
  }

  // Pending proposals grouped by comment — only a COUNT of proposers, never who (#6).
  async listProposals(teamId: number, requesterId: number) {
    await loadLiveTeam(this.prisma, teamId);
    await assertManager(this.prisma, teamId, requesterId);
    const groups = await this.prisma.focusPointProposal.groupBy({
      by: ['commentId'],
      where: { status: 'PENDING', comment: { teamId } },
      _count: { _all: true }
    });
    if (groups.length === 0) return [];
    const comments = await this.prisma.comment.findMany({
      where: { id: { in: groups.map((g) => g.commentId) } },
      select: { id: true, content: true, type: true, sprintId: true, category: { select: { label: true } }, sprint: { select: { name: true } } }
    });
    const byId = new Map(comments.map((c) => [c.id, c]));
    return groups
      .map((g) => ({ comment: byId.get(g.commentId)!, proposerCount: g._count._all }))
      .filter((g) => g.comment)
      .sort((a, b) => b.proposerCount - a.proposerCount)
      .map((g) => ({
        commentId: g.comment.id, content: g.comment.content, type: g.comment.type,
        category: g.comment.category?.label ?? null, sprintId: g.comment.sprintId, sprintName: g.comment.sprint.name,
        proposerCount: g.proposerCount
      }));
  }

  async dismissProposals(commentId: number, requesterId: number) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { teamId: true } });
    if (!comment) throw new NotFoundException('Comment not found');
    await assertManager(this.prisma, comment.teamId, requesterId);
    const dismissed = await this.prisma.focusPointProposal.updateMany({ where: { commentId, status: 'PENDING' }, data: { status: 'DISMISSED' } });
    logFocusEvent(this.logger, 'proposals_dismissed', { teamId: comment.teamId, commentId, count: dismissed.count, byManager: requesterId });
    return { success: true };
  }

  // The management view: the pool with scores and trend by sprint. Results exist only for sprints
  // whose rating window is closed, and only when the team + raters are enough to stay anonymous.
  async list(teamId: number, requesterId: number, includeMerged = false) {
    const team = await loadLiveTeam(this.prisma, teamId);
    await assertManager(this.prisma, teamId, requesterId);
    const activeMembers = await countActiveHumanMembers(this.prisma, teamId);

    const points = await this.prisma.focusPoint.findMany({
      where: { teamId, ...(includeMerged ? {} : { status: { not: 'MERGED' } }) },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        sources: { select: { comment: { select: { id: true, content: true, type: true, sprintId: true } } } },
        tasks: { orderBy: { id: 'asc' }, include: { assignee: { select: { id: true, username: true, firstName: true, lastName: true } } } },
        selections: { select: { sprintId: true } },
        // NEVER select userId / reason of a rating here (#15).
        ratings: { select: { sprintId: true, sprintEndedAt: true, score: true } },
        _count: { select: { mergedFrom: true, proposals: { where: { status: 'PENDING' } } } }
      }
    });

    const sprintIds = Array.from(new Set(points.flatMap((p) => [...p.selections.map((s) => s.sprintId), ...p.ratings.map((r) => r.sprintId).filter((x): x is number => x !== null)])));
    const [sprints, closes] = await Promise.all([
      this.prisma.sprint.findMany({ where: { id: { in: sprintIds } }, select: { id: true, name: true, endDate: true } }),
      this.prisma.sprintRatingClose.findMany({ where: { sprintId: { in: sprintIds } }, select: { sprintId: true } })
    ]);
    const sprintById = new Map(sprints.map((s) => [s.id, s]));
    const closed = new Set(closes.map((c) => c.sprintId));

    return {
      quota: team.focusPointQuota,
      activeMembers,
      resultsHidden: activeMembers < 3,
      points: points.map((p) => {
        const keys = new Map<string, { sprintId: number | null; endedAt: Date; scores: number[] }>();
        for (const sel of p.selections) {
          const sp = sprintById.get(sel.sprintId);
          if (sp) keys.set(`s${sp.id}`, { sprintId: sp.id, endedAt: sprintEndsAt(sp), scores: [] });
        }
        for (const r of p.ratings) {
          const key = r.sprintId !== null ? `s${r.sprintId}` : `d${r.sprintEndedAt.toISOString()}`;
          const entry = keys.get(key) ?? { sprintId: r.sprintId, endedAt: r.sprintEndedAt, scores: [] };
          entry.scores.push(r.score);
          keys.set(key, entry);
        }
        const ordered = Array.from(keys.values()).sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime());
        const finished = ordered.filter((e) => e.sprintId === null || closed.has(e.sprintId));
        const summaries = finished.map((e) => summarizeSprintRatings(e.scores, activeMembers));
        const { entries, currentScore } = p.kind === 'IMPROVE' ? buildHistory(p.initialScore, summaries) : { entries: [], currentScore: null };
        return {
          id: p.id, kind: p.kind, text: p.text, status: p.status, initialScore: p.initialScore,
          watchSprintsLeft: p.watchSprintsLeft, createdAt: p.createdAt, closedAt: p.closedAt, mergedIntoId: p.mergedIntoId,
          mentionCount: p.sources.length,
          sources: p.sources.map((s) => s.comment),
          proposalCount: p._count.proposals, mergedFromCount: p._count.mergedFrom,
          selectedSprintIds: p.selections.map((s) => s.sprintId),
          currentScore,
          history: p.kind === 'IMPROVE'
            ? ordered.map((e) => {
                const idx = finished.indexOf(e);
                const sp = e.sprintId !== null ? sprintById.get(e.sprintId) : undefined;
                const base = { sprintId: e.sprintId, sprintName: sp?.name ?? null, endedAt: e.endedAt, closed: idx !== -1 };
                return idx === -1 ? { ...base, raterCount: e.scores.length, average: null, valid: false, trend: null } : { ...base, ...entries[idx] };
              })
            : [],
          tasks: p.tasks
        };
      })
    };
  }

  async history(id: number, requesterId: number) {
    await this.loadManaged(id, requesterId);
    return this.prisma.focusPointTextVersion.findMany({
      where: { focusPointId: id }, orderBy: { id: 'asc' },
      select: { id: true, text: true, createdAt: true, changedBy: { select: { id: true, username: true, firstName: true, lastName: true } } }
    });
  }
}
