import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { CreateInviteDto, CreatePhantomConversionInviteDto, ConsumePhantomConversionInviteDto } from './dto/invites.dto';
import { assertCanManageTeamContent } from '../teams/team-permissions.util';

@Injectable()
export class InvitesService {
  // Same fallback secret/pattern as auth.service.ts — the conversion flow mints a real 12h
  // session token, same shape as register()/login().
  private readonly jwtSecret = process.env.JWT_SECRET || 'retro-secret-key-12345';

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
      include: {
        team: { select: { name: true } },
        // Feature 9 (phantom members, §9.1): only populated for a conversion link — used below
        // to prefill the conversion form with the phantom's existing display name.
        convertsMember: { include: { user: { select: { firstName: true, lastName: true } } } }
      }
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    const reason = this.reasonForInvalidity(invite);
    // `convertsMemberId` is a real Prisma column and therefore always present (null or a real
    // id) on data actually read from the DB, but truthy-check anyway so a partial/mocked object
    // in a test never gets misread as a conversion invite just because the field is `undefined`.
    const isPhantomConversion = !!invite.convertsMemberId;

    return {
      teamName: invite.team.name,
      email: invite.email,
      valid: !reason,
      reason: reason || undefined,
      type: isPhantomConversion ? 'phantomConversion' : 'join',
      prefill: isPhantomConversion && invite.convertsMember
        ? { firstName: invite.convertsMember.user.firstName, lastName: invite.convertsMember.user.lastName }
        : undefined
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

  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decision #3, §9.1):
  // deliberately NOT an extension of createInvite — this always locks maxUses to 1, email to
  // null, and stamps convertsMemberId so consumePhantomConversionInvite (below) knows to run the
  // conversion flow instead of the regular join flow.
  async createPhantomConversionInvite(teamId: number, phantomMemberId: number, dto: CreatePhantomConversionInviteDto, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await assertCanManageTeamContent(this.prisma, teamId, requesterId);

    const targetMember = await this.prisma.teamMember.findFirst({
      where: { id: phantomMemberId, teamId },
      include: { user: true }
    });
    if (!targetMember) {
      throw new NotFoundException('Team member not found in this team');
    }
    if (!targetMember.user.isPhantom) {
      throw new ConflictException('חבר זה כבר אינו חבר פנטום — לא ניתן ליצור קישור המרה עבורו');
    }

    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('תאריך התפוגה חייב להיות בעתיד');
    }

    return this.prisma.teamInvite.create({
      data: {
        token: crypto.randomBytes(24).toString('hex'),
        teamId,
        convertsMemberId: phantomMemberId,
        email: null,
        createdById: requesterId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        // A conversion link belongs to exactly one phantom — never makes sense more than once.
        maxUses: 1
      }
    });
  }

  // Feature 9 (§9.0 decision #3): deliberately NOT an extension of consumeInvite — there is no
  // logged-in user yet (the phantom's `User` row has `password: null`), so this fills in
  // username/email/password on the *existing* phantom `User` row (`update`, not `create`) and
  // never creates a new TeamMember (it already exists).
  async consumePhantomConversionInvite(token: string, dto: ConsumePhantomConversionInviteDto) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { token } });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    const reason = this.reasonForInvalidity(invite);
    if (reason) {
      throw new ConflictException(reason);
    }

    if (!invite.convertsMemberId) {
      throw new ConflictException('קישור זה אינו קישור המרת פנטום');
    }

    const targetMember = await this.prisma.teamMember.findUnique({ where: { id: invite.convertsMemberId } });
    if (!targetMember) {
      throw new NotFoundException('Team member not found');
    }

    const phantomUser = await this.prisma.user.findUnique({ where: { id: targetMember.userId } });
    if (!phantomUser) {
      throw new NotFoundException('User not found');
    }
    // Guards against re-consuming an already-converted phantom (e.g. the link opened twice).
    if (!phantomUser.isPhantom) {
      throw new ConflictException('חבר זה כבר הומר לחשבון רגיל');
    }

    // §9.0 decision #4: exclude the phantom's own row from the uniqueness check — unlike
    // auth.service.ts::register (always a fresh `create`), this is an `update` of a row that
    // already "holds" a (randomly-generated) username/email.
    const collision = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
        NOT: { id: phantomUser.id }
      }
    });
    if (collision) {
      throw new ConflictException('שם המשתמש או כתובת האימייל כבר תפוסים');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: phantomUser.id },
        data: {
          username: dto.username,
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName ?? phantomUser.firstName,
          lastName: dto.lastName ?? phantomUser.lastName,
          isPhantom: false
        }
      }),
      this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: { useCount: { increment: 1 } }
      })
    ]);

    // Same JWT payload shape/expiry as register()/login() — the user is logged straight in,
    // no separate login step.
    const accessToken = jwt.sign(
      { sub: updatedUser.id, username: updatedUser.username, email: updatedUser.email },
      this.jwtSecret,
      { expiresIn: '12h' }
    );

    const { password, ...userWithoutPassword } = updatedUser;
    return {
      accessToken,
      user: userWithoutPassword
    };
  }
}
