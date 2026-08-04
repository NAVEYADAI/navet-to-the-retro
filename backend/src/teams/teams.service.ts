import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTeamDto, AddMemberDto } from './dto/teams.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeamDto, creatorId: number) {
    // Create team and automatically add the creator as TEAM_LEADER
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        members: {
          create: {
            userId: creatorId,
            role: 'TEAM_LEADER'
          }
        }
      },
      include: {
        members: true
      }
    });

    return team;
  }

  async addMember(teamId: number, dto: AddMemberDto) {
    // Check if team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if already a member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: dto.userId,
          teamId: teamId
        }
      }
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this team');
    }

    return this.prisma.teamMember.create({
      data: {
        teamId: teamId,
        userId: dto.userId,
        role: dto.role
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  async getTeamsForUser(userId: number) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: userId },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return memberships.map(m => ({
      ...m.team,
      roleInTeam: m.role
    }));
  }

  async getTeamMembers(teamId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return this.prisma.teamMember.findMany({
      where: { teamId: teamId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }
}
