import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTeamDto, AddMemberDto, UpdateMemberDto } from './dto/teams.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeamDto, creatorId: number) {
    // Create team and automatically add the creator as TEAM_LEADER
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        mainOffice: dto.mainOffice,
        creatorId: creatorId,
        members: {
          create: {
            userId: creatorId,
            role: 'TEAM_LEADER',
            isAdmin: true
          }
        }
      },
      include: {
        members: true
      }
    });

    return team;
  }

  async addMember(teamId: number, dto: AddMemberDto, requesterId: number) {
    // Check if team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Verify requester is a member and has TEAM_LEADER role
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: teamId
        }
      }
    });
    if (!requesterMembership || requesterMembership.role !== 'TEAM_LEADER') {
      throw new ForbiddenException('Only team leaders can add members to the team');
    }

    // Find user to add by username or email
    const userToJoin = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          { email: dto.username }
        ]
      }
    });
    if (!userToJoin) {
      throw new NotFoundException(`User with username or email '${dto.username}' not found`);
    }

    // Check if already a member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: userToJoin.id,
          teamId: teamId
        }
      }
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this team');
    }

    const finalRole = dto.role || (userToJoin.role as any) || 'DEVELOPER';

    return this.prisma.teamMember.create({
      data: {
        teamId: teamId,
        userId: userToJoin.id,
        role: finalRole
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

  async updateMember(teamId: number, memberId: number, dto: UpdateMemberDto, requesterId: number) {
    // 1. Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // 2. Verify requester is a member of this team AND is an admin
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: teamId
        }
      }
    });
    if (!requesterMembership || !requesterMembership.isAdmin) {
      throw new ForbiddenException('Only team admins can manage members');
    }

    // 3. Verify target member belongs to this team
    const targetMember = await this.prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId: teamId
      }
    });
    if (!targetMember) {
      throw new NotFoundException('Team member not found in this team');
    }

    // 4. If we are removing the admin status of the last admin, prevent it!
    if (dto.isAdmin === false && targetMember.isAdmin) {
      const adminCount = await this.prisma.teamMember.count({
        where: {
          teamId: teamId,
          isAdmin: true
        }
      });
      if (adminCount <= 1) {
        throw new ConflictException('Cannot remove admin status from the only admin in the team');
      }
    }

    // 5. Update target member
    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: {
        role: dto.role,
        isAdmin: dto.isAdmin
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

  async updateTeam(teamId: number, dto: { name?: string; mainOffice?: string }, requesterId: number) {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: teamId
        }
      }
    });
    if (!membership || !membership.isAdmin) {
      throw new ForbiddenException('Only team admins can edit team details');
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        name: dto.name,
        mainOffice: dto.mainOffice
      }
    });
  }
}
