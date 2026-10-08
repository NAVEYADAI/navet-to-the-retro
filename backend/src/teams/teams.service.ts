import { Injectable, Logger, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { InvitesService } from '../invites/invites.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { CreateTeamDto, AddMemberDto, UpdateMemberDto, CreatePhantomMemberDto } from './dto/teams.dto';
import { assertCanManageTeamContent } from './team-permissions.util';
import { DEFAULT_CATEGORY_LABELS } from '../comments/comment-category-labels';
import {
  requireNonEmptyString,
  assertOptionalString,
  assertOptionalBoolean,
  assertOptionalEnum
} from '../common/validation';

// Feature 9 (phantom members, §9.2): `isPhantom` must be included everywhere a team member's
// `User` is selected, or the frontend badge has nothing to key off of. This is the shared
// constant already used by `getTeamsForUser` — the other member-select blocks below
// (`getTeamMembers`, `addMember`, `acceptMemberInvite`, `updateMember`) were still using their
// own inline `select` literals that predate this constant, so they're switched over here too.
const TEAM_MEMBER_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  isPhantom: true
};

// Only these two people are allowed to approve a new team's creation
const ALLOWED_APPROVER_EMAILS = ['naveyadai@gmail.com', 'lironka13@gmail.com'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// BUG-15: values the Prisma `TeamRole` enum accepts — anything else would be a 500 from Prisma.
const TEAM_ROLE_VALUES = ['TEAM_LEADER', 'PRODUCT_MANAGER', 'TESTER', 'DEVELOPER', 'DEVOPS'];
const INVALID_ROLE_MESSAGE = 'תפקיד לא תקין';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly invitesService: InvitesService,
    private readonly googleCalendarService: GoogleCalendarService
  ) {}

  // BUG-11: serialize every admin-set change (demote / remove) of one team. The "is this the last
  // active admin?" count and the write that follows must not interleave with another such
  // request on the same team, or two admins can demote each other concurrently and both pass.
  // Locking the Team row (SELECT ... FOR UPDATE) makes the second request wait until the first
  // commits, and its count then runs on fresh data (READ COMMITTED re-snapshots per statement).
  private async lockTeam(tx: Prisma.TransactionClient, teamId: number) {
    await tx.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${teamId} FOR UPDATE`;
  }

  // Only ACTIVE admins count: a PENDING (not-yet-accepted) admin can still decline, so it must
  // never be what keeps the team from being admin-less.
  private countActiveAdmins(tx: Prisma.TransactionClient, teamId: number) {
    return tx.teamMember.count({ where: { teamId, isAdmin: true, status: 'ACTIVE' } });
  }

  async getAllowedApprovers() {
    const users = await this.prisma.user.findMany({
      where: {
        OR: ALLOWED_APPROVER_EMAILS.map(email => ({ email: { equals: email, mode: 'insensitive' as const } }))
      },
      select: { email: true, firstName: true, lastName: true, username: true }
    });

    return ALLOWED_APPROVER_EMAILS.map(allowedEmail => {
      const match = users.find(u => u.email.toLowerCase() === allowedEmail.toLowerCase());
      const displayName = match
        ? (match.firstName || match.lastName ? `${match.firstName || ''} ${match.lastName || ''}`.trim() : match.username)
        : null;
      // Prefer the exact casing stored in the DB (if the person already registered) so a later
      // lookup by this value always matches — this is the value the client should send back.
      return { email: match?.email || allowedEmail, displayName };
    });
  }

  async create(dto: CreateTeamDto, creatorId: number) {
    // BUG-15: explicit runtime validation (the DTO is just a type) — missing/non-string fields
    // are a 400, not a TypeError/Prisma 500.
    requireNonEmptyString(dto?.name, 'שם הצוות הוא שדה חובה');
    assertOptionalString(dto.mainOffice, 'המשרד הראשי לא תקין');
    requireNonEmptyString(dto.approverEmail, 'צריך להזין אימייל של מאשר/ת');

    if (!ALLOWED_APPROVER_EMAILS.includes(dto.approverEmail.toLowerCase())) {
      throw new ForbiddenException('רק כתובות אימייל מורשות יכולות לאשר יצירת צוות.');
    }

    // The team only becomes usable once a second person (by email) approves it.
    // Case-insensitive match: the allowlist check above is normalized to lowercase, so the
    // lookup must be too, or a differently-cased (but otherwise valid) email would 404 here.
    // Feature 7 fallout (product-backlog/07-google-sign-in.md §7 findings, 2026-09-11): `User.email` is no longer
    // @unique (decision #3), so multiple rows can share an email — `orderBy` makes the pick
    // deterministic instead of depending on DB scan order, matching the pattern already used in
    // google-login.service.ts for the same underlying issue.
    const approver = await this.prisma.user.findFirst({
      where: { email: { equals: dto.approverEmail, mode: 'insensitive' } },
      orderBy: { id: 'asc' }
    });
    if (!approver) {
      throw new NotFoundException('לא נמצא משתמש עם כתובת האימייל הזו. בקש/י מהחבר להירשם קודם ולנסות שוב.');
    }
    if (approver.id === creatorId) {
      throw new ConflictException('לא ניתן להזמין את עצמך כמאשר/ת');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { firstName: true, lastName: true, username: true }
    });

    // Create team and automatically add the creator as TEAM_LEADER
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        mainOffice: dto.mainOffice,
        creatorId: creatorId,
        status: 'PENDING_APPROVAL',
        pendingApproverId: approver.id,
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

    // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.1):
    // every new team gets the 13 default categories automatically — see
    // scripts/backfill-team-comment-categories.js for the equivalent one-time seeding of
    // pre-existing teams. A separate call (not nested inside the team.create above) so it doesn't
    // require the team.create result before it can reference team.id.
    await this.prisma.teamCommentCategory.createMany({
      data: DEFAULT_CATEGORY_LABELS.map(label => ({ teamId: team.id, label, isDefault: true, isEnabled: true }))
    });

    const creatorName = creator?.firstName || creator?.lastName
      ? `${creator?.firstName || ''} ${creator?.lastName || ''}`.trim()
      : (creator?.username || 'משתמש');

    await this.emailService.sendTeamApprovalRequest({
      to: approver.email,
      teamName: dto.name,
      creatorName,
      mainOffice: dto.mainOffice
    });

    return team;
  }

  async approveTeam(teamId: number, requesterId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.status !== 'PENDING_APPROVAL') {
      throw new ConflictException('הצוות כבר אושר או בוטל');
    }
    if (team.pendingApproverId !== requesterId) {
      throw new ForbiddenException('רק המשתמש שהוזמן לאשר יכול לאשר את הצוות הזה');
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        status: 'ACTIVE',
        pendingApproverId: null
      },
      include: { members: true }
    });
  }

  async declineTeam(teamId: number, requesterId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (requesterId !== team.creatorId && requesterId !== team.pendingApproverId) {
      throw new ForbiddenException('רק היוצר/ת או המאשר/ת המוזמן/ת יכולים לבטל את הצוות');
    }
    if (team.status !== 'PENDING_APPROVAL') {
      throw new ConflictException('הצוות כבר אושר');
    }

    await this.prisma.team.delete({ where: { id: teamId } });
    return { success: true };
  }

  async addMember(teamId: number, dto: AddMemberDto, requesterId: number) {
    requireNonEmptyString(dto?.username, 'צריך להזין שם משתמש או אימייל');
    assertOptionalEnum(dto.role, TEAM_ROLE_VALUES, INVALID_ROLE_MESSAGE);

    // Check if team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.status !== 'ACTIVE') {
      throw new ConflictException('לא ניתן להוסיף חברים לצוות שטרם אושר');
    }

    // Verify requester is an admin member (consistent with updateMember/updateTeam below —
    // `role` is just a free-text job title, `isAdmin` is the actual permission flag)
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: teamId
        }
      }
    });
    if (!requesterMembership || requesterMembership.status !== 'ACTIVE' || !requesterMembership.isAdmin) {
      throw new ForbiddenException('Only team admins can add members to the team');
    }

    // Find user to add by username or email. BUG-19: email match is case-insensitive (usernames
    // stay exact); `User.email` isn't @unique, so order deterministically like the other lookups.
    const identifier = String(dto.username ?? '').trim();
    const userToJoin = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: { equals: identifier, mode: 'insensitive' } }
        ]
      },
      orderBy: { id: 'asc' }
    });
    // BUG-01: a phantom belongs to exactly the team that created it — never addable elsewhere.
    // Reported as "not found" (same as a non-existent user) so it doesn't confirm the account exists.
    if (userToJoin?.isPhantom) {
      throw new NotFoundException(`User with username or email '${identifier}' not found`);
    }
    if (!userToJoin) {
      // No account yet — if a valid email was given, invite them to register instead of a
      // hard 404. Registering through that invite's link joins the team immediately
      // (see InvitesService.consumeInvite), skipping the accept/decline step below entirely.
      if (EMAIL_PATTERN.test(identifier)) {
        return this.invitesService.createInvite(teamId, { email: identifier.toLowerCase(), role: dto.role }, requesterId);
      }
      throw new NotFoundException(`User with username or email '${identifier}' not found`);
    }

    // Check if already a member or already has a pending invite
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: userToJoin.id,
          teamId: teamId
        }
      }
    });
    if (existingMember) {
      throw new ConflictException(
        existingMember.status === 'PENDING'
          ? 'כבר נשלחה למשתמש/ת הזמנה ממתינה לצוות הזה'
          : 'User is already a member of this team'
      );
    }

    const finalRole = dto.role || (userToJoin.role as any) || 'DEVELOPER';

    // Doesn't join immediately — creates a pending in-app invite the invited user must
    // accept or decline themselves. No email is sent for this (unlike team-creation approval).
    return this.prisma.teamMember.create({
      data: {
        teamId: teamId,
        userId: userToJoin.id,
        role: finalRole,
        status: 'PENDING'
      },
      include: {
        user: { select: TEAM_MEMBER_USER_SELECT }
      }
    });
  }

  async acceptMemberInvite(teamId: number, memberId: number, requesterId: number) {
    const membership = await this.prisma.teamMember.findFirst({
      where: { id: memberId, teamId: teamId }
    });
    if (!membership) {
      throw new NotFoundException('Invite not found');
    }
    if (membership.userId !== requesterId) {
      throw new ForbiddenException('רק המשתמש/ת שהוזמן/ה יכולים לאשר הזמנה זו');
    }
    if (membership.status !== 'PENDING') {
      throw new ConflictException('ההזמנה כבר טופלה');
    }

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: { status: 'ACTIVE' },
      include: {
        user: { select: TEAM_MEMBER_USER_SELECT }
      }
    });
  }

  async declineMemberInvite(teamId: number, memberId: number, requesterId: number) {
    const membership = await this.prisma.teamMember.findFirst({
      where: { id: memberId, teamId: teamId }
    });
    if (!membership) {
      throw new NotFoundException('Invite not found');
    }
    if (membership.status !== 'PENDING') {
      throw new ConflictException('ההזמנה כבר טופלה');
    }

    // The invited user can decline their own invite; a team admin can cancel it too.
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: teamId } }
    });
    const isInvitee = membership.userId === requesterId;
    const isAdmin = requesterMembership?.status === 'ACTIVE' && !!requesterMembership.isAdmin;
    if (!isInvitee && !isAdmin) {
      throw new ForbiddenException('אין הרשאה לבטל הזמנה זו');
    }

    await this.prisma.teamMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  async getTeamsForUser(userId: number) {
    const teamInclude = {
      members: {
        include: {
          user: { select: TEAM_MEMBER_USER_SELECT }
        }
      },
      pendingApprover: { select: { id: true, email: true, username: true } }
    };

    const [memberships, pendingApprovals] = await Promise.all([
      this.prisma.teamMember.findMany({
        where: { userId: userId },
        include: { team: { include: teamInclude } }
      }),
      this.prisma.team.findMany({
        where: { pendingApproverId: userId, status: 'PENDING_APPROVAL' },
        include: teamInclude
      })
    ]);

    return [
      ...memberships.map(m => ({
        ...m.team,
        roleInTeam: m.status === 'PENDING' ? null : m.role,
        myMembershipId: m.id,
        myMembershipStatus: m.status
      })),
      ...pendingApprovals.map(t => ({ ...t, roleInTeam: null }))
    ];
  }

  async getTeamMembers(teamId: number, requesterId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // BUG-03: the list exposes every member's email/username, so only active members of this
    // team may read it (a still-pending invitee hasn't accepted yet, so they don't qualify).
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!requesterMembership || requesterMembership.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not belong to this team');
    }

    return this.prisma.teamMember.findMany({
      where: { teamId: teamId },
      include: {
        user: { select: TEAM_MEMBER_USER_SELECT }
      }
    });
  }

  async updateMember(teamId: number, memberId: number, dto: UpdateMemberDto, requesterId: number) {
    assertOptionalEnum(dto?.role, TEAM_ROLE_VALUES, INVALID_ROLE_MESSAGE);
    assertOptionalBoolean(dto.isAdmin, 'ערך הרשאת מנהל לא תקין');

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
    if (!requesterMembership || requesterMembership.status !== 'ACTIVE' || !requesterMembership.isAdmin) {
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

    // Nothing that can change the admin set — no need to serialize on the team.
    if (dto.isAdmin !== false) {
      return this.prisma.teamMember.update({
        where: { id: memberId },
        data: {
          role: dto.role,
          isAdmin: dto.isAdmin
        },
        include: {
          user: { select: TEAM_MEMBER_USER_SELECT }
        }
      });
    }

    // 4. Demoting an admin: never leave the team without an ACTIVE admin (BUG-11). The check and
    // the write run under the team lock so concurrent demotions can't both pass the count.
    return this.prisma.$transaction(async (tx) => {
      await this.lockTeam(tx, teamId);

      // Re-read under the lock — the target may have been demoted/removed while we waited.
      const lockedTarget = await tx.teamMember.findFirst({ where: { id: memberId, teamId } });
      if (!lockedTarget) {
        throw new NotFoundException('Team member not found in this team');
      }

      if (lockedTarget.isAdmin && lockedTarget.status === 'ACTIVE') {
        const activeAdmins = await this.countActiveAdmins(tx, teamId);
        if (activeAdmins <= 1) {
          throw new ConflictException('Cannot remove admin status from the only admin in the team');
        }
      }

      // 5. Update target member
      return tx.teamMember.update({
        where: { id: memberId },
        data: {
          role: dto.role,
          isAdmin: dto.isAdmin
        },
        include: {
          user: { select: TEAM_MEMBER_USER_SELECT }
        }
      });
    });
  }

  async removeMember(teamId: number, memberId: number, requesterId: number) {
    // 1. Verify team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId }
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // 2. Verify requester is an admin member of this team
    const requesterMembership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: teamId
        }
      }
    });
    if (!requesterMembership || requesterMembership.status !== 'ACTIVE' || !requesterMembership.isAdmin) {
      throw new ForbiddenException('Only team admins can remove members');
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

    // 4. Never leave the team without an ACTIVE admin (BUG-11) — count only ACTIVE admins, and
    // run the check + delete under the team lock so two concurrent removals can't both pass it.
    await this.prisma.$transaction(async (tx) => {
      await this.lockTeam(tx, teamId);

      const lockedTarget = await tx.teamMember.findFirst({ where: { id: memberId, teamId } });
      if (!lockedTarget) {
        throw new NotFoundException('Team member not found in this team');
      }

      if (lockedTarget.isAdmin && lockedTarget.status === 'ACTIVE') {
        const activeAdmins = await this.countActiveAdmins(tx, teamId);
        if (activeAdmins <= 1) {
          throw new ConflictException('Cannot remove the only admin in the team');
        }
      }

      await tx.teamMember.delete({ where: { id: memberId } });
    });

    // BUG-52: best-effort — stop syncing sprint events to the removed member's Google Calendar
    // (delete their events for this team). Never fails/blocks the removal itself.
    try {
      await this.googleCalendarService.removeMemberFromTeam(targetMember.userId, teamId);
    } catch (err) {
      this.logger.warn(
        `Google Calendar cleanup failed for member ${targetMember.userId} removed from team ${teamId}`,
        err instanceof Error ? err.stack : err
      );
    }
    return { success: true };
  }

  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.1): creates a real
  // `User` row (password: null, isPhantom: true, auto-generated username/email — never shown to
  // anyone) plus a `TeamMember` for it in one nested write, mirroring how `create()` above adds
  // the team creator as a member. Same guard as the other two phantom-member actions (§9.0
  // decision #1).
  async createPhantomMember(teamId: number, dto: CreatePhantomMemberDto, requesterId: number) {
    requireNonEmptyString(dto?.firstName, 'שם פרטי הוא שדה חובה');
    assertOptionalString(dto.lastName, 'שם משפחה לא תקין');
    assertOptionalEnum(dto.role, TEAM_ROLE_VALUES, INVALID_ROLE_MESSAGE);

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    // BUG-36: a team still awaiting approval isn't usable yet (same rule as addMember).
    if (team.status !== 'ACTIVE') {
      throw new ConflictException('לא ניתן להוסיף חברים לצוות שטרם אושר');
    }
    await assertCanManageTeamContent(this.prisma, teamId, requesterId);

    const username = `phantom_${crypto.randomBytes(8).toString('hex')}`;

    const user = await this.prisma.user.create({
      data: {
        username,
        // Deterministic from the already-unique username, never shown in any UI (see §9.0
        // "ברירת מחדל טכנית" addendum, 2026-09-14) — just here to satisfy the non-nullable
        // `User.email` column.
        email: `${username}@phantom.local`,
        password: null,
        isPhantom: true,
        firstName: dto.firstName,
        lastName: dto.lastName,
        members: {
          create: {
            teamId,
            role: dto.role || 'DEVELOPER',
            isAdmin: false,
            status: 'ACTIVE'
          }
        }
      },
      include: {
        members: { where: { teamId } }
      }
    });

    // Every User-shaped response strips `password` manually — see backend/AGENTS.md.
    const { password, ...result } = user;
    return result;
  }

  async updateTeam(teamId: number, dto: { name?: string; mainOffice?: string }, requesterId: number) {
    // BUG-39: a team that doesn't exist is a 404 (it used to fall through the membership check
    // below and come back as a misleading 403).
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const membership = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: requesterId,
          teamId: teamId
        }
      }
    });
    if (!membership || membership.status !== 'ACTIVE' || !membership.isAdmin) {
      throw new ForbiddenException('Only team admins can edit team details');
    }

    // BUG-36: the approval e-mail already went out with the original name, so a team that is
    // still awaiting approval can't be edited.
    if (team.status !== 'ACTIVE') {
      throw new ConflictException('לא ניתן לערוך צוות שטרם אושר');
    }

    // BUG-36: a provided name must not be empty/whitespace (undefined = leave unchanged).
    let name = dto.name;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        throw new BadRequestException('שם הצוות לא יכול להיות ריק');
      }
      name = name.trim();
    }
    assertOptionalString(dto.mainOffice, 'המשרד הראשי לא תקין');

    const updatedTeam = await this.prisma.team.update({
      where: { id: teamId },
      data: {
        name,
        mainOffice: dto.mainOffice
      }
    });

    // BUG-52: a rename must reach the per-team Google calendars (best-effort, never fails the
    // edit — same external-service pattern as sprint sync).
    if (name !== undefined && name !== team.name) {
      try {
        await this.googleCalendarService.syncTeamRenamed(teamId, name);
      } catch (err) {
        this.logger.warn(`Google Calendar sync failed for renamed team ${teamId}`, err instanceof Error ? err.stack : err);
      }
    }

    return updatedTeam;
  }
}
