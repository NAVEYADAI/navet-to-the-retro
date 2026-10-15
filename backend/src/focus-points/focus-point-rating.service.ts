import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { logFocusEvent } from './focus-point-log';
import { PrismaService } from '../prisma.service';
import { RateFocusPointDto } from './dto/focus-points.dto';
import { assertOptionalString, assertOptionalPositiveInt } from '../common/validation';
import { isDeleted } from '../common/soft-delete';
import {
  assertManager, loadSprintForMember, countActiveHumanMembers, sprintEndsAt
} from './focus-point-access';
import { averageOf, canShowResults, reachedGoal, SCORE_MAX, SCORE_MIN } from './focus-point-score';

export const MAX_REASON_LENGTH = 1000;

export type RatingWindowState = 'NOT_OPEN' | 'OPEN' | 'CLOSED';

// Feature 20 (§20.1): everything a team member does (propose, rate, see the active points) plus the
// management steps that drive a sprint (select for the sprint, close the rating window).
@Injectable()
export class FocusPointRatingService {
  private readonly logger = new Logger(FocusPointRatingService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async windowState(sprint: { id: number; endDate: Date }, now = new Date()): Promise<RatingWindowState> {
    const closed = await this.prisma.sprintRatingClose.findUnique({ where: { sprintId: sprint.id } });
    if (closed) return 'CLOSED';
    return now.getTime() >= sprintEndsAt(sprint).getTime() ? 'OPEN' : 'NOT_OPEN';
  }

  // "הצע כנקודה": any ACTIVE member. A second proposal of the same comment by the same member is a
  // 409; many members may propose the same comment (#6). Nothing about who is ever returned.
  async propose(commentId: number, requesterId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { sprint: { select: { deletedAt: true } }, team: { select: { deletedAt: true } } }
    });
    if (!comment || isDeleted(comment.team) || isDeleted(comment.sprint)) {
      throw new NotFoundException('Comment not found');
    }
    const membership = await this.prisma.teamMember.findUnique({ where: { userId_teamId: { userId: requesterId, teamId: comment.teamId } } });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Comment not found');
    }
    const existing = await this.prisma.focusPointProposal.findUnique({ where: { commentId_userId: { commentId, userId: requesterId } } });
    if (existing) {
      throw new ConflictException('כבר הצעת את ההערה הזו');
    }
    await this.prisma.focusPointProposal.create({ data: { commentId, userId: requesterId } });
    // Not who: proposals are anonymous to the managers too (decision #6).
    logFocusEvent(this.logger, 'proposed', { teamId: comment.teamId, commentId });
    return { success: true };
  }

  // Which comments the requester already proposed — lets the UI show "הצעת כבר" without exposing anyone else.
  async myProposedCommentIds(sprintId: number, requesterId: number) {
    await loadSprintForMember(this.prisma, sprintId, requesterId);
    const rows = await this.prisma.focusPointProposal.findMany({
      where: { userId: requesterId, comment: { sprintId } }, select: { commentId: true }
    });
    return rows.map((r) => r.commentId);
  }

  // What a member sees (#9): the points selected for this sprint, their own rating, and the window
  // state — never a score, an average, a trend, or anyone else's rating.
  async sprintView(sprintId: number, requesterId: number) {
    const { sprint } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    const [selections, state] = await Promise.all([
      this.prisma.focusPointSprint.findMany({
        where: { sprintId, focusPoint: { kind: 'IMPROVE' } },
        orderBy: { id: 'asc' },
        select: { focusPoint: { select: { id: true, text: true } } }
      }),
      this.windowState(sprint)
    ]);
    const mine = await this.prisma.focusPointRating.findMany({
      where: { sprintId, userId: requesterId }, select: { focusPointId: true, score: true, reason: true }
    });
    const myById = new Map(mine.map((r) => [r.focusPointId, r]));
    return {
      window: state,
      points: selections.map((s) => ({
        id: s.focusPoint.id, text: s.focusPoint.text,
        myRating: myById.get(s.focusPoint.id) ? { score: myById.get(s.focusPoint.id)!.score, reason: myById.get(s.focusPoint.id)!.reason } : null
      }))
    };
  }

  async rate(focusPointId: number, dto: RateFocusPointDto, requesterId: number) {
    assertOptionalPositiveInt(dto?.sprintId, 'מזהה הספרינט לא תקין');
    if (!dto?.sprintId) throw new BadRequestException('מזהה הספרינט לא תקין');
    if (typeof dto.score !== 'number' || !Number.isInteger(dto.score) || dto.score < SCORE_MIN || dto.score > SCORE_MAX) {
      throw new BadRequestException('הציון חייב להיות מספר שלם בין 1 ל-5');
    }
    assertOptionalString(dto.reason, 'הסיבה חייבת להיות טקסט');
    const reason = typeof dto.reason === 'string' && dto.reason.trim() ? dto.reason.trim() : null;
    if (reason && reason.length > MAX_REASON_LENGTH) {
      throw new BadRequestException(`הסיבה ארוכה מדי (עד ${MAX_REASON_LENGTH} תווים)`);
    }

    const { sprint } = await loadSprintForMember(this.prisma, dto.sprintId, requesterId);
    const me = await this.prisma.user.findUnique({ where: { id: requesterId }, select: { isPhantom: true } });
    if (me?.isPhantom) throw new BadRequestException('פנטומים לא מדרגים');

    const selected = await this.prisma.focusPointSprint.findUnique({
      where: { focusPointId_sprintId: { focusPointId, sprintId: sprint.id } },
      include: { focusPoint: { select: { teamId: true, kind: true } } }
    });
    if (!selected || selected.focusPoint.teamId !== sprint.teamId || selected.focusPoint.kind !== 'IMPROVE') {
      throw new NotFoundException('Focus point not found in this sprint');
    }
    const state = await this.windowState(sprint);
    if (state === 'NOT_OPEN') throw new BadRequestException('חלון הדירוג ייפתח בסוף הספרינט');
    if (state === 'CLOSED') throw new ConflictException('חלון הדירוג נסגר');

    // One rating per member per point per sprint; the unique-ness is enforced here because userId is nullable.
    let isUpdate = false;
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.focusPointRating.findFirst({ where: { focusPointId, sprintId: sprint.id, userId: requesterId } });
      isUpdate = !!existing;
      if (existing) {
        await tx.focusPointRating.update({ where: { id: existing.id }, data: { score: dto.score, reason } });
      } else {
        await tx.focusPointRating.create({
          data: { focusPointId, sprintId: sprint.id, sprintEndedAt: sprintEndsAt(sprint), userId: requesterId, score: dto.score, reason }
        });
      }
    });
    // Neither the rater nor the score: the log must not link a person to a rating.
    logFocusEvent(this.logger, 'rated', { teamId: sprint.teamId, sprintId: sprint.id, pointId: focusPointId, isUpdate, hasReason: !!reason });
    return { score: dto.score, reason };
  }

  // §20.0 #10: management picks the points to push this sprint, up to the team's quota (improve only).
  async select(sprintId: number, focusPointId: number, requesterId: number) {
    const { sprint } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    await assertManager(this.prisma, sprint.teamId, requesterId);
    const point = await this.prisma.focusPoint.findUnique({ where: { id: focusPointId } });
    if (!point || point.teamId !== sprint.teamId) throw new NotFoundException('Focus point not found');
    if (point.kind !== 'IMPROVE') throw new BadRequestException('אפשר לבחור לקידום רק נקודות שיפור');
    if (point.status !== 'ACTIVE') throw new BadRequestException('אפשר לבחור רק נקודה פעילה');
    if ((await this.windowState(sprint)) === 'CLOSED') throw new ConflictException('חלון הדירוג של הספרינט כבר נסגר');

    await this.prisma.$transaction(async (tx) => {
      const already = await tx.focusPointSprint.findUnique({ where: { focusPointId_sprintId: { focusPointId, sprintId } } });
      if (already) return;
      const used = await tx.focusPointSprint.count({ where: { sprintId, focusPoint: { kind: 'IMPROVE', status: 'ACTIVE' } } });
      if (used >= sprint.team.focusPointQuota) {
        throw new ConflictException(`הגעתם למכסה של ${sprint.team.focusPointQuota} נקודות לספרינט`);
      }
      await tx.focusPointSprint.create({ data: { focusPointId, sprintId, selectedById: requesterId } });
      logFocusEvent(this.logger, 'selected', { teamId: sprint.teamId, sprintId, pointId: focusPointId, selectedCount: used + 1, quota: sprint.team.focusPointQuota, byManager: requesterId });
    });
    return { success: true };
  }

  async deselect(sprintId: number, focusPointId: number, requesterId: number) {
    const { sprint } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    await assertManager(this.prisma, sprint.teamId, requesterId);
    const hasRatings = await this.prisma.focusPointRating.count({ where: { focusPointId, sprintId } });
    if (hasRatings > 0) throw new ConflictException('כבר דורגה בספרינט הזה, אי אפשר להסיר אותה');
    await this.prisma.focusPointSprint.deleteMany({ where: { focusPointId, sprintId } });
    logFocusEvent(this.logger, 'deselected', { teamId: sprint.teamId, sprintId, pointId: focusPointId, byManager: requesterId });
    return { success: true };
  }

  // §20.0 #13, #16, #18: management closes the window. For every selected point with a VALID result
  // (enough raters AND a big enough team): reaching 4.5 closes it; otherwise a "watch for N more
  // sprints" counts down and archives it at 0. An invalid sprint changes nothing.
  async closeWindow(sprintId: number, requesterId: number) {
    const { sprint } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    await assertManager(this.prisma, sprint.teamId, requesterId);
    const state = await this.windowState(sprint);
    if (state === 'NOT_OPEN') throw new BadRequestException('הספרינט עדיין לא הסתיים');
    if (state === 'CLOSED') throw new ConflictException('חלון הדירוג כבר נסגר');

    const activeMembers = await countActiveHumanMembers(this.prisma, sprint.teamId);
    const outcomes = await this.prisma.$transaction(async (tx) => {
      // The unique `sprintId` is the guard against two managers closing at the same moment.
      try {
        await tx.sprintRatingClose.create({ data: { sprintId, closedById: requesterId } });
      } catch (err: any) {
        if (err?.code === 'P2002') throw new ConflictException('חלון הדירוג כבר נסגר');
        throw err;
      }
      const selections = await tx.focusPointSprint.findMany({
        where: { sprintId, focusPoint: { kind: 'IMPROVE', status: 'ACTIVE' } },
        include: { focusPoint: true }
      });
      const result: { focusPointId: number; outcome: 'CLOSED' | 'ARCHIVED' | 'CONTINUES' | 'NOT_COUNTED' }[] = [];
      for (const sel of selections) {
        const scores = (await tx.focusPointRating.findMany({ where: { focusPointId: sel.focusPointId, sprintId }, select: { score: true } })).map((r) => r.score);
        if (!canShowResults(activeMembers, scores.length)) {
          result.push({ focusPointId: sel.focusPointId, outcome: 'NOT_COUNTED' });
          continue;
        }
        if (reachedGoal(averageOf(scores))) {
          await tx.focusPoint.update({ where: { id: sel.focusPointId }, data: { status: 'CLOSED', closedAt: new Date(), watchSprintsLeft: null } });
          result.push({ focusPointId: sel.focusPointId, outcome: 'CLOSED' });
        } else if (sel.focusPoint.watchSprintsLeft !== null) {
          const left = sel.focusPoint.watchSprintsLeft - 1;
          await tx.focusPoint.update({
            where: { id: sel.focusPointId },
            data: left <= 0 ? { status: 'ARCHIVED', watchSprintsLeft: null } : { watchSprintsLeft: left }
          });
          result.push({ focusPointId: sel.focusPointId, outcome: left <= 0 ? 'ARCHIVED' : 'CONTINUES' });
        } else {
          result.push({ focusPointId: sel.focusPointId, outcome: 'CONTINUES' });
        }
      }
      return result;
    });
    const count = (o: string) => outcomes.filter((x) => x.outcome === o).length;
    logFocusEvent(this.logger, 'window_closed', {
      teamId: sprint.teamId, sprintId, activeMembers, points: outcomes.length,
      closed: count('CLOSED'), archived: count('ARCHIVED'), continues: count('CONTINUES'), notCounted: count('NOT_COUNTED'),
      byManager: requesterId,
    });
    return { success: true, outcomes };
  }
}
