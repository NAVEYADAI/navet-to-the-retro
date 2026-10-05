import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommentDto, UpdateHighlightDto } from './dto/comments.dto';
import { assertCanManageTeamContent } from '../teams/team-permissions.util';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sprintId: number, dto: CreateCommentDto, requesterId: number) {
    // 1. Verify sprint exists
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId }
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // 2. Verify requester belongs to the team of the sprint
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: sprint.teamId
        }
      }
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('You are not a member of this team');
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

    // 4. Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md
    // §3.1): real validation, not just the DB's FK constraint — categoryId (if present) must
    // belong to this same sprint's team AND be enabled, otherwise a clear 400/404 instead of an
    // opaque Prisma FK-violation 500.
    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      const category = await this.prisma.teamCommentCategory.findFirst({
        where: { id: dto.categoryId, teamId: sprint.teamId }
      });
      if (!category) {
        throw new NotFoundException('הקטגוריה שנבחרה לא נמצאה עבור צוות זה');
      }
      if (!category.isEnabled) {
        throw new BadRequestException('לא ניתן לבחור בקטגוריה שהושבתה');
      }
    }

    // 5. Create comment
    return this.prisma.comment.create({
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
  }

  async getCommentsForSprint(sprintId: number, requesterId: number) {
    // 1. Verify sprint exists
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId }
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // 2. Verify requester is a member of the team
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: sprint.teamId
        }
      }
    });
    if (!requesterMembership || requesterMembership.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not belong to this team');
    }

    // 3. Fetch comments
    const comments = await this.prisma.comment.findMany({
      where: { sprintId: sprintId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            isPhantom: true
          }
        },
        // Feature 9 (phantom members, §9.1): always returned when present, visible to every team
        // member (§9.0 decision #2 — "on behalf of" comments can never be anonymous, so there's
        // no masking conflict with the isAnonymous logic below).
        postedByAdmin: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md
        // §3.1): join the label directly so the frontend doesn't need a separate categories
        // fetch just to display an existing comment's category name — works even if the
        // category was since disabled (still has a label), unlike the enabledOnly-filtered
        // GET /teams/:teamId/categories list.
        category: {
          select: {
            id: true,
            label: true
          }
        }
      }
    });

    // 4. Return comments, masking author if comment is anonymous (no one, including admins, can unmask it)
    return comments.map(c => this.maskIfAnonymous(c));
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
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
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
}
