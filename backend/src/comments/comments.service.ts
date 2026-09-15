import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    if (!membership) {
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
      if (!targetMembership) {
        throw new NotFoundException('Team member not found in this team');
      }

      authorId = dto.onBehalfOfUserId;
      postedByAdminId = requesterId;
      isAnonymous = false;
    }

    // 4. Create comment
    return this.prisma.comment.create({
      data: {
        content: dto.content,
        type: dto.type,
        category: dto.category,
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
    if (!requesterMembership) {
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
        }
      }
    });

    // 4. Return comments, masking author if comment is anonymous (no one, including admins, can unmask it)
    return comments.map(c => {
      if (c.isAnonymous) {
        return {
          ...c,
          author: {
            id: 0,
            username: 'Anonymous',
            firstName: 'Anonymous',
            lastName: '',
            isPhantom: false
          }
        };
      }
      return c;
    });
  }

  async setHighlighted(commentId: number, dto: UpdateHighlightDto, requesterId: number) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Only team admins and team leads may highlight — see product-backlog/02-comment-highlighting.md §2.0.
    await assertCanManageTeamContent(this.prisma, comment.teamId, requesterId);

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { isHighlighted: dto.isHighlighted }
    });
  }
}
