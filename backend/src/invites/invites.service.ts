import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { CreateInviteDto } from './dto/invites.dto';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  private async assertIsTeamAdmin(teamId: number, requesterId: number) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!membership || !membership.isAdmin) {
      throw new ForbiddenException('Only team admins can manage invites');
    }
  }

  // reasonForInvalidity(invite) => a specific, user-facing reason the invite can't be used —
  // shared by the public lookup (getInvite) and the actual join (consumeInvite) so both agree.
  private reasonForInvalidity(invite: { isRevoked: boolean; expiresAt: Date | null; maxUses: number | null; useCount: number }): string | null {
    if (invite.isRevoked) return 'ההזמנה בוטלה';
    if (invite.expiresAt && invite.expiresAt < new Date()) return 'ההזמנה פגה';
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return 'ההזמנה כבר נוצלה';
    return null;
  }

  async createInvite(teamId: number, dto: CreateInviteDto, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await this.assertIsTeamAdmin(teamId, requesterId);

    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('תאריך התפוגה חייב להיות בעתיד');
    }

    if (dto.email) {
      const existing = await this.prisma.teamInvite.findFirst({
        where: { teamId, email: { equals: dto.email, mode: 'insensitive' } }
      });
      if (existing && !this.reasonForInvalidity(existing)) {
        throw new ConflictException('כבר נשלחה הזמנה ממתינה לכתובת האימייל הזו');
      }
    }

    const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
    const inviterName = requester?.firstName || requester?.lastName
      ? `${requester?.firstName || ''} ${requester?.lastName || ''}`.trim()
      : (requester?.username || 'משתמש');

    const invite = await this.prisma.teamInvite.create({
      data: {
        token: crypto.randomBytes(24).toString('hex'),
        teamId,
        name: dto.name?.trim() || null,
        email: dto.email || null,
        role: dto.role || 'DEVELOPER',
        createdById: requesterId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        // A personal (email-locked) invite is inherently single-use; a generic link's
        // maxUses is whatever the admin chose (or unlimited if omitted).
        maxUses: dto.email ? 1 : (dto.maxUses ?? null)
      }
    });

    if (dto.email) {
      await this.emailService.sendTeamJoinInvite({
        to: dto.email,
        teamName: team.name,
        inviterName,
        token: invite.token
      });
    }

    return invite;
  }

  async getInvite(token: string) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { token },
      include: { team: { select: { name: true } } }
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    const reason = this.reasonForInvalidity(invite);
    return {
      teamName: invite.team.name,
      email: invite.email,
      valid: !reason,
      reason: reason || undefined
    };
  }

  async listInvites(teamId: number, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await this.assertIsTeamAdmin(teamId, requesterId);

    return this.prisma.teamInvite.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async revokeInvite(teamId: number, inviteId: number, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await this.assertIsTeamAdmin(teamId, requesterId);

    const invite = await this.prisma.teamInvite.findFirst({ where: { id: inviteId, teamId } });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    return this.prisma.teamInvite.update({
      where: { id: inviteId },
      data: { isRevoked: true }
    });
  }

  async consumeInvite(token: string, user: { id: number; email: string }) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { token } });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    const reason = this.reasonForInvalidity(invite);
    if (reason) {
      throw new ConflictException(reason);
    }

    if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException('ההזמנה מיועדת לכתובת אימייל אחרת');
    }

    const team = await this.prisma.team.findUnique({ where: { id: invite.teamId } });
    if (!team || team.status !== 'ACTIVE') {
      throw new ConflictException('לא ניתן להצטרף לצוות שטרם אושר');
    }

    const existingMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: user.id, teamId: invite.teamId } }
    });
    if (existingMembership) {
      throw new ConflictException('כבר חבר/ה בצוות זה');
    }

    const [membership] = await this.prisma.$transaction([
      this.prisma.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId: user.id,
          role: invite.role,
          isAdmin: false,
          status: 'ACTIVE'
        },
        include: { team: true }
      }),
      this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: { useCount: { increment: 1 } }
      })
    ]);

    return membership;
  }
}
