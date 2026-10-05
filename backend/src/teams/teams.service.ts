import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { InvitesService } from '../invites/invites.service';
import { CreateTeamDto, AddMemberDto, UpdateMemberDto, CreatePhantomMemberDto } from './dto/teams.dto';
import { assertCanManageTeamContent } from './team-permissions.util';
import { DEFAULT_CATEGORY_LABELS } from '../comments/comment-category-labels';

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

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly invitesService: InvitesService
  ) {}

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

    // Find user to add by username or email
    const userToJoin = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          { email: dto.username }
        ]
      }
    });
    // BUG-01: a phantom belongs to exactly the team that created it — never addable elsewhere.
    // Reported as "not found" (same as a non-existent user) so it doesn't confirm the account exists.
    if (userToJoin?.isPhantom) {
      throw new NotFoundException(`User with username or email '${dto.username}' not found`);
    }
    if (!userToJoin) {
      // No account yet — if a valid email was given, invite them to register instead of a
      // hard 404. Registering through that invite's link joins the team immediately
      // (see InvitesService.consumeInvite), skipping the accept/decline step below entirely.
      if (EMAIL_PATTERN.test(dto.username)) {
        return this.invitesService.createInvite(teamId, { email: dto.username, role: dto.role }, requesterId);
      }
      throw new NotFoundException(`User with username or email '${dto.username}' not found`);
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
        user: { select: TEAM_MEMBER_USER_SELECT }
      }
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

    // 4. Never leave the team without an admin
    if (targetMember.isAdmin) {
      const adminCount = await this.prisma.teamMember.count({
        where: {
          teamId: teamId,
          isAdmin: true
        }
      });
      if (adminCount <= 1) {
        throw new ConflictException('Cannot remove the only admin in the team');
      }
    }

    await this.prisma.teamMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.1): creates a real
  // `User` row (password: null, isPhantom: true, auto-generated username/email — never shown to
  // anyone) plus a `TeamMember` for it in one nested write, mirroring how `create()` above adds
  // the team creator as a member. Same guard as the other two phantom-member actions (§9.0
  // decision #1).
  async createPhantomMember(teamId: number, dto: CreatePhantomMemberDto, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
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

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        name: dto.name,
        mainOffice: dto.mainOffice
      }
    });
  }
}
