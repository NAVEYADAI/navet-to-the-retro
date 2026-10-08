import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { CreateInviteDto, CreatePhantomConversionInviteDto, ConsumePhantomConversionInviteDto } from './dto/invites.dto';
import {
  parseExpiryInput,
  requireNonEmptyString,
  assertOptionalString,
  assertOptionalPositiveInt,
  assertOptionalEnum
} from '../common/validation';
import { getJwtSecret } from '../config/jwt-secret';
import { MIN_PASSWORD_LENGTH } from '../auth/auth.service';

// BUG-15: shape check for the public invite token (generated as 48 hex chars). A token carrying
// a NUL byte or an absurd length used to reach Prisma/Postgres and come back as a 500.
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// Same loose email shape as auth.service.ts (BUG-18).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class InvitesService {
  // Same fallback secret/pattern as auth.service.ts — the conversion flow mints a real 12h
  // session token, same shape as register()/login().
  private readonly jwtSecret = getJwtSecret();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  private async assertIsTeamAdmin(teamId: number, requesterId: number) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!membership || membership.status !== 'ACTIVE' || !membership.isAdmin) {
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

  // BUG-06: the maxUses check in reasonForInvalidity runs on a value read before the increment, so
  // concurrent consumers all pass it. Claim the use atomically instead — the WHERE clause is
  // evaluated by the DB at write time, so only maxUses claims can succeed. Must run inside the
  // same transaction as the join so a failed join releases the claim.
  private async claimInviteUse(
    tx: Prisma.TransactionClient,
    invite: { id: number; maxUses: number | null }
  ) {
    const claimed = await tx.teamInvite.updateMany({
      where: {
        id: invite.id,
        isRevoked: false,
        ...(invite.maxUses !== null ? { useCount: { lt: invite.maxUses } } : {})
      },
      data: { useCount: { increment: 1 } }
    });
    if (claimed.count === 0) {
      throw new ConflictException('ההזמנה כבר נוצלה');
    }
  }

  async createInvite(teamId: number, dto: CreateInviteDto, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    await this.assertIsTeamAdmin(teamId, requesterId);

    // BUG-15/BUG-32: field types are checked explicitly; `expiresAt` goes through
    // parseExpiryInput (garbage -> 400; date-only -> end of that day in Israel, so "today" is OK);
    // `maxUses` must be a positive Int32 (0/negative used to create an already-"used up" link).
    assertOptionalString(dto?.name, 'שם ההזמנה לא תקין');
    assertOptionalString(dto.email, 'כתובת האימייל לא תקינה');
    assertOptionalEnum(dto.role, ['TEAM_LEADER', 'PRODUCT_MANAGER', 'TESTER', 'DEVELOPER', 'DEVOPS'], 'תפקיד לא תקין');
    assertOptionalPositiveInt(dto.maxUses, 'מספר השימושים המרבי חייב להיות מספר שלם חיובי');
    const expiresAt = dto.expiresAt ? parseExpiryInput(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('תאריך התפוגה חייב להיות בעתיד');
    }

    // BUG-19: emails are case-insensitive everywhere else (lookup, consumeInvite) — store and
    // send the normalized form so the invite row never differs from the account's address only
    // by casing.
    const email = dto.email?.trim().toLowerCase() || null;

    if (email) {
      const existing = await this.prisma.teamInvite.findFirst({
        where: { teamId, email: { equals: email, mode: 'insensitive' } }
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
        email,
        role: dto.role || 'DEVELOPER',
        createdById: requesterId,
        expiresAt,
        // A personal (email-locked) invite is inherently single-use; a generic link's
        // maxUses is whatever the admin chose (or unlimited if omitted).
        maxUses: email ? 1 : (dto.maxUses ?? null)
      }
    });

    if (email) {
      await this.emailService.sendTeamJoinInvite({
        to: email,
        teamName: team.name,
        inviterName,
        token: invite.token
      });
    }

    return invite;
  }

  private assertValidToken(token: unknown): asserts token is string {
    if (typeof token !== 'string' || !INVITE_TOKEN_PATTERN.test(token)) {
      throw new BadRequestException('קישור ההזמנה לא תקין');
    }
  }

  async getInvite(token: string) {
    this.assertValidToken(token);
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
    this.assertValidToken(token);
    const invite = await this.prisma.teamInvite.findUnique({ where: { token } });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // BUG-10: a phantom-conversion invite (convertsMemberId set) must only be redeemable through
    // consumePhantomConversionInvite — otherwise a stranger could use it as a generic join link,
    // burn its single use and lock the real phantom out of converting.
    if (invite.convertsMemberId) {
      throw new ConflictException('קישור זה הוא קישור המרת פנטום ולא קישור הצטרפות לצוות');
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

    const membership = await this.prisma.$transaction(async (tx) => {
      await this.claimInviteUse(tx, invite);
      return tx.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId: user.id,
          role: invite.role,
          isAdmin: false,
          status: 'ACTIVE'
        },
        include: { team: true }
      });
    });

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
    // BUG-44: same admin-only guard as list/revoke above — a TEAM_LEADER who isn't an admin
    // used to be able to mint a conversion link they could then neither see nor revoke.
    await this.assertIsTeamAdmin(teamId, requesterId);

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

    const expiresAt = dto?.expiresAt ? parseExpiryInput(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('תאריך התפוגה חייב להיות בעתיד');
    }

    return this.prisma.teamInvite.create({
      data: {
        token: crypto.randomBytes(24).toString('hex'),
        teamId,
        convertsMemberId: phantomMemberId,
        email: null,
        createdById: requesterId,
        expiresAt,
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
    this.assertValidToken(token);
    // BUG-15: same rules as auth.service.ts::register (required strings, email shape, minimum
    // password length, username-that-looks-like-an-email must equal the email — BUG-38). Checked
    // before any DB access so bad input is a 400, never a 500 from bcrypt/Prisma.
    dto = dto ?? ({} as ConsumePhantomConversionInviteDto);
    const username = requireNonEmptyString(dto.username, 'שם משתמש הוא שדה חובה').trim();
    const rawEmail = requireNonEmptyString(dto.email, 'כתובת אימייל היא שדה חובה').trim();
    if (!EMAIL_PATTERN.test(rawEmail)) {
      throw new BadRequestException('כתובת האימייל אינה תקינה');
    }
    const email = rawEmail.toLowerCase();
    if (typeof dto.password !== 'string' || dto.password.length === 0) {
      throw new BadRequestException('סיסמה היא שדה חובה');
    }
    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
    }
    if (username.includes('@') && username.toLowerCase() !== email) {
      throw new BadRequestException('שם משתמש שנראה כמו כתובת אימייל חייב להיות זהה לכתובת האימייל שלך');
    }
    assertOptionalString(dto.firstName, 'שם פרטי לא תקין');
    assertOptionalString(dto.lastName, 'שם משפחה לא תקין');

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
    // BUG-01: the phantom must belong to the team that issued this invite, otherwise whoever
    // controls the invite's team could take over a phantom from another team.
    if (!targetMember || targetMember.teamId !== invite.teamId) {
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
        OR: [{ username }, { email: { equals: email, mode: 'insensitive' } }],
        NOT: { id: phantomUser.id }
      }
    });
    if (collision) {
      throw new ConflictException('שם המשתמש או כתובת האימייל כבר תפוסים');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await this.claimInviteUse(tx, invite);
      return tx.user.update({
        where: { id: phantomUser.id },
        data: {
          username,
          email,
          password: hashedPassword,
          firstName: dto.firstName ?? phantomUser.firstName,
          lastName: dto.lastName ?? phantomUser.lastName,
          isPhantom: false
        }
      });
    });

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
