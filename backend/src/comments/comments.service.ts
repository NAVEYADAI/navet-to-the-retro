import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommentDto } from './dto/comments.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCommentDto, authorId: number) {
    // Check if team exists
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Verify user belongs to the team
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: authorId,
          teamId: dto.teamId
        }
      }
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    return this.prisma.comment.create({
      data: {
        content: dto.content,
        authorId: authorId,
        teamId: dto.teamId
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

  async getCommentsForTeam(teamId: number, requestorId: number) {
    // Check if team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Verify requesting user is a member of the team
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requestorId,
          teamId: teamId
        }
      }
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    return this.prisma.comment.findMany({
      where: { teamId: teamId },
      orderBy: { createdAt: 'desc' },
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
}
