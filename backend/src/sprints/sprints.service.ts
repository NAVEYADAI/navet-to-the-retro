import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSprintDto } from './dto/sprints.dto';

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
}
