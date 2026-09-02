import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSprintDto } from './dto/sprints.dto';
import { buildSprintSummaryPptx, buildExportFileName, resolveTemplateId } from './sprint-summary.builder';

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (!requesterMembership || !requesterMembership.isAdmin) {
      throw new ForbiddenException('Only team admins can create sprints');
    }

    // 3. Create sprint
    return this.prisma.sprint.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        teamId: teamId
      }
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
    if (!requesterMembership) {
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
    // PRODUCT-BACKLOG.md §1.0 (updated 2026-09-01 per Nave: admins should also be able to).
    if (team.creatorId !== requesterId) {
      const membership = await this.prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: requesterId, teamId } }
      });
      if (!membership || !membership.isAdmin) {
        throw new ForbiddenException('רק מי שיצר את הצוות או מנהל צוות יכולים לייצא סיכום ספרינט');
      }
    }

    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, teamId } });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const comments = await this.prisma.comment.findMany({
      where: { sprintId },
      select: { content: true, type: true, category: true }
    });

    const buffer = await buildSprintSummaryPptx({
      sprintName: sprint.name,
      teamName: team.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      comments,
      templateId: resolveTemplateId(templateId)
    });

    return { buffer, fileName: buildExportFileName(sprint.name) };
  }
}
