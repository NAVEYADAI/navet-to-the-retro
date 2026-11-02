import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommentDto, UpdateCommentDto, UpdateHighlightDto } from './dto/comments.dto';
import { loadSprintForMember, isSprintWritableFor, isAnonymousAllowed, ANONYMOUS_LOCKED_MESSAGE, ANONYMOUS_LOCKED_EDIT_MESSAGE } from './comments-access';
import { SprintLockedException, isWithinWriteWindow } from '../sprints/sprint-write-window.util';
import { assertCanManageTeamContent } from '../teams/team-permissions.util';
import {
  requireNonEmptyString,
  assertOptionalBoolean,
  assertOptionalEnum,
  assertOptionalPositiveInt
} from '../common/validation';
import { isDeleted } from '../common/soft-delete';

// BUG-15: values the Prisma `CommentType` enum accepts.
const COMMENT_TYPE_VALUES = ['KEEP', 'IMPROVE'];

// The frontend sets no input limit on a note, so the server is the only cap. Generous enough for any
// real note (the PPTX export truncates at 500 anyway), small enough to stop a megabyte body.
export const MAX_COMMENT_LENGTH = 2000;
const COMMENT_TOO_LONG_MESSAGE = `ההערה ארוכה מדי (עד ${MAX_COMMENT_LENGTH} תווים)`;

function assertContentLength(content: string) {
  if (content.length > MAX_COMMENT_LENGTH) {
    throw new BadRequestException(COMMENT_TOO_LONG_MESSAGE);
  }
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sprintId: number, dto: CreateCommentDto, requesterId: number) {
    // BUG-15: explicit body validation before any DB access. `type` is required and must be a
    // real CommentType; content required & non-blank; the optional fields must have the right
    // JS type (a string categoryId or "yes" for isAnonymous used to reach Prisma as a 500).
    requireNonEmptyString(dto?.content, 'תוכן ההערה הוא שדה חובה');
    assertContentLength(dto.content);
    if (dto.type === undefined || dto.type === null) {
      throw new BadRequestException('סוג ההערה הוא שדה חובה');
    }
    assertOptionalEnum(dto.type, COMMENT_TYPE_VALUES, 'סוג ההערה לא תקין');
    assertOptionalPositiveInt(dto.categoryId, 'קטגוריה לא תקינה');
    assertOptionalBoolean(dto.isAnonymous, 'ערך האנונימיות לא תקין');
    assertOptionalPositiveInt(dto.onBehalfOfUserId, 'מזהה המשתמש לא תקין');

    // 1+2. Sprint exists (Feature 14: a soft-deleted sprint/team does not) and the requester is an
    // ACTIVE member of its team. BUG-40: both failures are the same 404 (no id enumeration).
    const { sprint } = await loadSprintForMember(this.prisma, sprintId, requesterId);

    // Feature 13 §13.0 decision #1: one write window for writing, editing and deleting. Outside it
    // (and with no active extension for this user) the board is locked.
    if (!(await isSprintWritableFor(this.prisma, sprint, requesterId))) {
      throw new SprintLockedException();
    }

    // 3. Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decision #1/#2):
    // "posting on behalf of" someone else (a phantom, or a real member) requires the same
    // admin/team-leader guard as the other two phantom-member actions, and forces
    // `isAnonymous: false` server-side no matter what the request body sent — the client isn't
    // trusted to just hide the checkbox.
    let authorId = requesterId;
    let postedByAdminId: number | null = null;
    let isAnonymous = dto.isAnonymous ?? false;

    if (dto.onBehalfOfUserId) {
      await assertCanManageTeamContent(this.prisma, sprint.teamId, requesterId);

      const targetMembership = await this.prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: dto.onBehalfOfUserId,
            teamId: sprint.teamId
          }
        }
      });
      if (!targetMembership || targetMembership.status !== 'ACTIVE') {
        throw new NotFoundException('Team member not found in this team');
      }

      authorId = dto.onBehalfOfUserId;
      postedByAdminId = requesterId;
      isAnonymous = false;
    }

    // Feature 13 (security): once the board is locked, a member writing only thanks to an admin's
    // extension is the only one who can write — an anonymous note would be identifiable by its
    // timestamp. Named comments are fine.
    if (isAnonymous && !isAnonymousAllowed(isWithinWriteWindow(sprint))) {
      throw new ForbiddenException(ANONYMOUS_LOCKED_MESSAGE);
    }

    // 4. Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md
    // §3.1): real validation, not just the DB's FK constraint — categoryId (if present) must
    // belong to this same sprint's team AND be enabled, otherwise a clear 400/404 instead of an
    // opaque Prisma FK-violation 500.
    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      await this.assertCategoryUsable(sprint.teamId, dto.categoryId);
    }

    // 5. Create comment
    const created = await this.prisma.comment.create({
      data: {
        content: dto.content,
        type: dto.type,
        categoryId: dto.categoryId ?? null,
        isAnonymous,
        authorId,
        postedByAdminId,
        teamId: sprint.teamId,
        sprintId: sprintId
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        postedByAdmin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        category: {
          select: {
            id: true,
            label: true
          }
        }
      }
    });
    // Feature 13: the creator can edit/delete what they just wrote (the window was checked above).
    return { ...created, isMine: true, canEdit: true, canDelete: true };
  }

  private async assertCategoryUsable(teamId: number, categoryId: number) {
    const category = await this.prisma.teamCommentCategory.findFirst({
      where: { id: categoryId, teamId }
    });
    if (!category) {
      throw new NotFoundException('הקטגוריה שנבחרה לא נמצאה עבור צוות זה');
    }
    if (!category.isEnabled) {
      throw new BadRequestException('לא ניתן לבחור בקטגוריה שהושבתה');
    }
  }

  async getCommentsForSprint(sprintId: number, requesterId: number) {
    // 1+2. Sprint exists (Feature 14) and the requester is an ACTIVE member (BUG-40: same 404).
    const { sprint, membership } = await loadSprintForMember(this.prisma, sprintId, requesterId);

    // 3. Fetch comments. Feature 13: soft-deleted comments never reach the board.
    const comments = await this.prisma.comment.findMany({
      where: { sprintId: sprintId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: this.commentInclude
    });

    // Feature 11 (product-backlog/11-team-leave-and-removal.md §11.0 decision #4): flag comments
    // whose author is no longer an ACTIVE member, so the UI can label them "לא בצוות". Computed,
    // not stored — it clears by itself if they rejoin. One query for the whole sprint.
    const activeMembers = await this.prisma.teamMember.findMany({
      where: { teamId: sprint.teamId, status: 'ACTIVE' },
      select: { userId: true }
    });
    const activeUserIds = new Set(activeMembers.map(m => m.userId));

    // Feature 13: whether THIS requester may currently edit their own comments on this sprint.
    const writable = await isSprintWritableFor(this.prisma, sprint, requesterId);
    const ctx = { requesterId, isAdmin: membership.isAdmin === true, writable, windowOpen: isWithinWriteWindow(sprint) };

    // 4. Return comments. `isMine` / `canEdit` / `canDelete` are computed from the REAL authorId
    // BEFORE masking (an anonymous comment hides its author from everyone, the writer included, so
    // the client could not tell which one is theirs otherwise) and only ever say something about
    // the requester themselves — so BUG-02 still holds: no one can unmask an anonymous comment.
    // The authorIsActiveMember flag is left off masked comments — it would leak something about
    // who wrote them.
    return comments.map(c => {
      const flagged = { ...c, ...this.permissionsFor(c, ctx) };
      return c.isAnonymous
        ? this.maskIfAnonymous(flagged)
        : { ...flagged, authorIsActiveMember: activeUserIds.has(c.authorId) };
    });
  }

  private readonly commentInclude = {
    author: {
      select: { id: true, username: true, firstName: true, lastName: true, isPhantom: true }
    },
    // Feature 9 (phantom members, §9.1): always returned when present, visible to every team
    // member (§9.0 decision #2 — "on behalf of" comments can never be anonymous, so there's
    // no masking conflict with the isAnonymous logic).
    postedByAdmin: {
      select: { id: true, username: true, firstName: true, lastName: true }
    },
    // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md
    // §3.1): join the label directly so the frontend doesn't need a separate categories
    // fetch just to display an existing comment's category name — works even if the
    // category was since disabled (still has a label), unlike the enabledOnly-filtered
    // GET /teams/:teamId/categories list.
    category: {
      select: { id: true, label: true }
    }
  } as const;

  /**
   * Feature 13 §13.0 decision #4/#5. Who may touch a comment:
   *  - isMine: the requester wrote it (`authorId`) or posted it in someone's name (`postedByAdminId`);
   *  - canEdit: isMine AND the sprint is writable for them (window or active extension);
   *  - canDelete: canEdit, or the requester is a team admin (moderation — any time, any comment).
   */
  private permissionsFor(
    c: { authorId: number; postedByAdminId: number | null; isAnonymous: boolean },
    ctx: { requesterId: number; isAdmin: boolean; writable: boolean; windowOpen: boolean }
  ) {
    const isMine = c.authorId === ctx.requesterId || c.postedByAdminId === ctx.requesterId;
    // An anonymous comment can be touched by its writer only inside the common window — afterwards
    // the edit/delete timestamp would identify them (they can only write thanks to an extension).
    const anonymousLocked = c.isAnonymous && !ctx.windowOpen;
    const canEdit = isMine && ctx.writable && !anonymousLocked;
    return { isMine, canEdit, canDelete: canEdit || (ctx.isAdmin && !(isMine && anonymousLocked)) };
  }

  // BUG-02: masks both the nested `author` and the flat `authorId` column — leaving `authorId`
  // in place would let anyone map an anonymous comment back to its writer.
  private maskIfAnonymous<T extends { isAnonymous: boolean; authorId: number }>(comment: T) {
    if (!comment.isAnonymous) {
      return comment;
    }
    const { authorId: _authorId, ...rest } = comment;
    return {
      ...rest,
      author: {
        id: 0,
        username: 'Anonymous',
        firstName: 'Anonymous',
        lastName: '',
        isPhantom: false
      }
    };
  }

  async setHighlighted(commentId: number, dto: UpdateHighlightDto, requesterId: number) {
    // BUG-15: isHighlighted must be a real boolean (a string used to reach Prisma as a 500).
    if (typeof dto?.isHighlighted !== 'boolean') {
      throw new BadRequestException('ערך ההדגשה לא תקין');
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { sprint: { select: { deletedAt: true, team: { select: { deletedAt: true } } } } }
    });
    // Feature 14: comments of a soft-deleted sprint/team are hidden until it is restored.
    // Feature 13: a soft-deleted comment is gone for everyone.
    if (!comment || isDeleted(comment) || isDeleted(comment.sprint) || isDeleted(comment.sprint?.team)) {
      throw new NotFoundException('Comment not found');
    }

    // BUG-40: someone who isn't an active member of the comment's team gets the same 404 as for a
    // non-existent comment (no id enumeration). Active members who simply lack the admin/leader
    // role still get the 403 from the guard below.
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: comment.teamId } }
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Comment not found');
    }

    // Only team admins and team leads may highlight — see product-backlog/02-comment-highlighting.md §2.0.
    await assertCanManageTeamContent(this.prisma, comment.teamId, requesterId);

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { isHighlighted: dto.isHighlighted }
    });
    return this.maskIfAnonymous(updated);
  }

  /**
   * Loads a comment for a mutation. Same 404 for: no such comment, soft-deleted comment, deleted
   * sprint/team, and a requester who is not an ACTIVE member of the comment's team (BUG-40).
   */
  private async loadMutableComment(commentId: number, requesterId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { sprint: { select: { id: true, endDate: true, deletedAt: true, team: { select: { deletedAt: true } } } } }
    });
    if (!comment || isDeleted(comment) || isDeleted(comment.sprint) || isDeleted(comment.sprint?.team)) {
      throw new NotFoundException('Comment not found');
    }
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: comment.teamId } }
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Comment not found');
    }
    const isOwner = comment.authorId === requesterId || comment.postedByAdminId === requesterId;
    return { comment, membership, isOwner };
  }

  // Feature 13: edit content / column (`type`) / category of an existing comment.
  async update(commentId: number, dto: UpdateCommentDto, requesterId: number) {
    // Explicit body validation first (no DB access for a malformed body), like create().
    if (dto === null || typeof dto !== 'object') {
      throw new BadRequestException('גוף הבקשה לא תקין');
    }
    // §13.0 technical default #3: anonymity is fixed at creation.
    if (dto.isAnonymous !== undefined) {
      throw new BadRequestException('לא ניתן לשנות אנונימיות של הערה קיימת');
    }
    const hasContent = dto.content !== undefined;
    const hasType = dto.type !== undefined;
    const hasCategory = dto.categoryId !== undefined;
    if (!hasContent && !hasType && !hasCategory) {
      throw new BadRequestException('לא נשלח שינוי');
    }
    if (hasContent) {
      requireNonEmptyString(dto.content, 'תוכן ההערה הוא שדה חובה');
      assertContentLength(dto.content as string);
    }
    if (hasType) {
      if (dto.type === null) throw new BadRequestException('סוג ההערה לא תקין');
      assertOptionalEnum(dto.type, COMMENT_TYPE_VALUES, 'סוג ההערה לא תקין');
    }
    assertOptionalPositiveInt(dto.categoryId, 'קטגוריה לא תקינה');

    const { comment, isOwner } = await this.loadMutableComment(commentId, requesterId);

    // §13.0 decision #4: the writer and the one who posted in their name — nobody else, admins included
    // (an admin moderates by deleting, not by rewriting someone's words).
    if (!isOwner) {
      throw new ForbiddenException('אפשר לערוך רק הערה שכתבת');
    }
    if (!(await isSprintWritableFor(this.prisma, comment.sprint, requesterId))) {
      throw new SprintLockedException();
    }
    if (comment.isAnonymous && !isWithinWriteWindow(comment.sprint)) {
      throw new ForbiddenException(ANONYMOUS_LOCKED_EDIT_MESSAGE);
    }

    // Only fields that really change are written; `updatedAt` is stamped only then.
    const data: { content?: string; type?: 'KEEP' | 'IMPROVE'; categoryId?: number | null; updatedAt?: Date } = {};
    if (hasContent && dto.content !== comment.content) data.content = dto.content;
    if (hasType && dto.type !== comment.type) data.type = dto.type;
    if (hasCategory) {
      const next = dto.categoryId ?? null;
      if (next !== comment.categoryId) {
        // Moving to a new category must be a live category of this team; leaving it unchanged is
        // always fine (it may have been disabled since the comment was written).
        if (next !== null) await this.assertCategoryUsable(comment.teamId, next);
        data.categoryId = next;
      }
    }

    if (Object.keys(data).length > 0) data.updatedAt = new Date();
    // An empty `data` is a no-op write that still returns the fresh row with its relations.
    const result = await this.prisma.comment.update({ where: { id: commentId }, data, include: this.commentInclude });

    // Same shape as a board comment; the writer's own flags, computed before masking (BUG-02).
    const flagged = { ...result, isMine: true, canEdit: true, canDelete: true };
    return this.maskIfAnonymous(flagged);
  }

  // Feature 13: soft delete. The writer / poster inside the write window, or a team admin any time.
  async remove(commentId: number, requesterId: number) {
    const { comment, membership, isOwner } = await this.loadMutableComment(commentId, requesterId);
    const isAdmin = membership.isAdmin === true;

    if (isOwner) {
      if (comment.isAnonymous && !isWithinWriteWindow(comment.sprint)) {
        throw new ForbiddenException(ANONYMOUS_LOCKED_EDIT_MESSAGE);
      }
      // Moderation (admin) is exempt from the window — §13.0 technical default #5.
      if (!isAdmin && !(await isSprintWritableFor(this.prisma, comment.sprint, requesterId))) {
        throw new SprintLockedException();
      }
    } else if (!isAdmin) {
      // A team leader (non-admin) does NOT get to delete someone else's comment — §13.0 decision #5.
      throw new ForbiddenException('אפשר למחוק רק הערה שכתבת');
    }

    const deletedAt = new Date();
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt, deletedById: requesterId }
    });
    return { id: commentId, deletedAt };
  }

  // Feature 13 §13.0 decision #5/#6: admin-only list of the sprint's deleted comments. Anonymous
  // comments stay masked; who deleted them and when is shown.
  async getDeletedComments(sprintId: number, requesterId: number) {
    const { membership } = await loadSprintForMember(this.prisma, sprintId, requesterId);
    if (membership.isAdmin !== true) {
      throw new ForbiddenException('רק מנהל צוות יכול לראות הערות שנמחקו');
    }

    const deleted = await this.prisma.comment.findMany({
      where: { sprintId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        ...this.commentInclude,
        deletedBy: { select: { id: true, username: true, firstName: true, lastName: true } }
      }
    });

    return deleted.map(({ deletedBy, deletedById, ...c }) => {
      const deletedByAuthor = deletedById !== null && deletedById === c.authorId;
      // An anonymous comment deleted by its own writer must not name the deleter — that would
      // unmask the writer (BUG-02). The flag alone says "the writer removed it themselves", which
      // every possible writer could equally have done.
      const shownDeleter = c.isAnonymous && deletedByAuthor ? null : deletedBy;
      return this.maskIfAnonymous({ ...c, deletedBy: shownDeleter, deletedByAuthor });
    });
  }
}
