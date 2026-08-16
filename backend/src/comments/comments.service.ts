import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommentDto } from './dto/comments.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sprintId: number, dto: CreateCommentDto, authorId: number) {
    // 1. Verify sprint exists
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId }
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // 2. Verify user belongs to the team of the sprint
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: authorId,
          teamId: sprint.teamId
        }
      }
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    // 3. Create comment
    return this.prisma.comment.create({
      data: {
        content: dto.content,
        type: dto.type,
        category: dto.category,
        isAnonymous: dto.isAnonymous ?? false,
        authorId: authorId,
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
            lastName: ''
          }
        };
      }
      return c;
    });
  }
}
