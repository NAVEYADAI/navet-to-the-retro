import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { InvitesService } from '../invites/invites.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('TeamsService', () => {
  let service: TeamsService;

  const creator = { id: 1, username: 'creator', email: 'creator@example.com', firstName: 'Cre', lastName: 'Ator' };
  const approver = { id: 2, username: 'approver', email: 'naveyadai@gmail.com', firstName: 'Nave', lastName: 'Yadai' };

  const mockTeam = {
    id: 10,
    name: 'Core Team',
    mainOffice: 'Haifa',
    status: 'PENDING_APPROVAL',
    creatorId: creator.id,
    pendingApproverId: approver.id,
    members: [],
  };

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    team: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamMember: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    // Feature 3 (team comment categories): seeded automatically on team creation.
    teamCommentCategory: {
      createMany: jest.fn(),
    },
    // Interactive transactions: run the callback against the same mock client (BUG-11).
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockPrismaService)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  const mockEmailService = {
    sendTeamApprovalRequest: jest.fn().mockResolvedValue(undefined),
  };

  const mockInvitesService = {
    createInvite: jest.fn(),
  };

  const mockGoogleCalendarService = {
    syncTeamRenamed: jest.fn().mockResolvedValue(undefined),
    removeMemberFromTeam: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: InvitesService, useValue: mockInvitesService },
        { provide: GoogleCalendarService, useValue: mockGoogleCalendarService },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllowedApprovers', () => {
    it('returns both allowlist entries with null displayName when nobody has registered yet', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.getAllowedApprovers();

      expect(result).toEqual([
        { email: 'naveyadai@gmail.com', displayName: null },
        { email: 'lironka13@gmail.com', displayName: null },
      ]);
    });

    it('resolves a matched user\'s displayName and DB-cased email', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([approver]);

      const result = await service.getAllowedApprovers();

      expect(result).toEqual(
        expect.arrayContaining([
          { email: approver.email, displayName: 'Nave Yadai' },
        ])
      );
    });
  });

  describe('create', () => {
    const dto = { name: 'Core Team', mainOffice: 'Haifa', approverEmail: approver.email };

    it('throws ForbiddenException when approverEmail is not in the allowlist', async () => {
      await expect(
        service.create({ ...dto, approverEmail: 'random@example.com' }, creator.id)
      ).rejects.toThrow(ForbiddenException);
    });

    // BUG-15: used to be a TypeError on `.toLowerCase()` (500).
    it.each([
      ['missing approverEmail', { name: 'T', mainOffice: 'H' }],
      ['non-string approverEmail', { name: 'T', approverEmail: 5 }],
      ['empty approverEmail', { name: 'T', approverEmail: '' }],
      ['missing name', { approverEmail: approver.email }],
      ['blank name', { name: '  ', approverEmail: approver.email }],
      ['non-string mainOffice', { name: 'T', mainOffice: 7, approverEmail: approver.email }],
    ])('rejects %s with BadRequestException without touching the DB (BUG-15)', async (_label, body) => {
      await expect(service.create(body as any, creator.id)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.team.create).not.toHaveBeenCalled();
    });

    it('accepts a differently-cased but allowlisted approverEmail', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(approver);
      mockPrismaService.user.findUnique.mockResolvedValue(creator);
      mockPrismaService.team.create.mockResolvedValue(mockTeam);

      await service.create({ ...dto, approverEmail: 'NaveYadai@Gmail.com' }, creator.id);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'NaveYadai@Gmail.com', mode: 'insensitive' } },
        orderBy: { id: 'asc' },
      });
    });

    it('throws NotFoundException when the approver email has no registered user', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.create(dto, creator.id)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the approver is the creator themself', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ ...approver, id: creator.id });

      await expect(service.create(dto, creator.id)).rejects.toThrow(ConflictException);
    });

    it('creates the team as PENDING_APPROVAL with the creator auto-added as TEAM_LEADER admin, and emails the approver', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(approver);
      mockPrismaService.user.findUnique.mockResolvedValue(creator);
      mockPrismaService.team.create.mockResolvedValue(mockTeam);

      const result = await service.create(dto, creator.id);

      expect(mockPrismaService.team.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          mainOffice: dto.mainOffice,
          creatorId: creator.id,
          status: 'PENDING_APPROVAL',
          pendingApproverId: approver.id,
          members: {
            create: { userId: creator.id, role: 'TEAM_LEADER', isAdmin: true },
          },
        },
        include: { members: true },
      });
      expect(mockEmailService.sendTeamApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({ to: approver.email, teamName: dto.name })
      );
      expect(result).toBe(mockTeam);

      // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.1):
      // the 13 defaults are seeded for every new team, not just pre-existing ones via the
      // one-time backfill script.
      expect(mockPrismaService.teamCommentCategory.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ teamId: mockTeam.id, isDefault: true, isEnabled: true }),
        ]),
      });
      expect(mockPrismaService.teamCommentCategory.createMany.mock.calls[0][0].data).toHaveLength(13);
    });
  });

  describe('approveTeam', () => {
    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.approveTeam(mockTeam.id, approver.id)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester is not the designated approver', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);

      await expect(service.approveTeam(mockTeam.id, creator.id)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when the team is no longer PENDING_APPROVAL', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({ ...mockTeam, status: 'ACTIVE' });

      await expect(service.approveTeam(mockTeam.id, approver.id)).rejects.toThrow(ConflictException);
    });

    it('flips the team to ACTIVE without adding the approver as a member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.team.update.mockResolvedValue({ ...mockTeam, status: 'ACTIVE', pendingApproverId: null });

      await service.approveTeam(mockTeam.id, approver.id);

      expect(mockPrismaService.team.update).toHaveBeenCalledWith({
        where: { id: mockTeam.id },
        data: { status: 'ACTIVE', pendingApproverId: null },
        include: { members: true },
      });
      expect(mockPrismaService.teamMember.create).not.toHaveBeenCalled();
    });
  });

  describe('declineTeam', () => {
    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.declineTeam(mockTeam.id, creator.id)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a requester who is neither creator nor approver', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);

      await expect(service.declineTeam(mockTeam.id, 999)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when the team is already ACTIVE', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({ ...mockTeam, status: 'ACTIVE' });

      await expect(service.declineTeam(mockTeam.id, creator.id)).rejects.toThrow(ConflictException);
    });

    it('allows the creator to decline', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.team.delete.mockResolvedValue(mockTeam);

      const result = await service.declineTeam(mockTeam.id, creator.id);

      expect(mockPrismaService.team.delete).toHaveBeenCalledWith({ where: { id: mockTeam.id } });
      expect(result).toEqual({ success: true });
    });

    it('allows the pending approver to decline', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.team.delete.mockResolvedValue(mockTeam);

      const result = await service.declineTeam(mockTeam.id, approver.id);

      expect(mockPrismaService.team.delete).toHaveBeenCalledWith({ where: { id: mockTeam.id } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('addMember', () => {
    const activeTeam = { ...mockTeam, status: 'ACTIVE' };
    const admin = { userId: creator.id, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER', status: 'ACTIVE' };
    const nonAdmin = { userId: approver.id, teamId: mockTeam.id, isAdmin: false, role: 'DEVELOPER', status: 'ACTIVE' };
    const invitee = { id: 5, username: 'invitee', email: 'invitee@example.com', role: 'DEVELOPER' };

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.addMember(mockTeam.id, { username: 'x', role: 'DEVELOPER' } as any, creator.id))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the team is not yet ACTIVE', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam); // status: PENDING_APPROVAL

      await expect(service.addMember(mockTeam.id, { username: 'x', role: 'DEVELOPER' } as any, creator.id))
        .rejects.toThrow(ConflictException);
      expect(mockPrismaService.teamMember.findUnique).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester is not an admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.addMember(activeTeam.id, { username: 'x', role: 'DEVELOPER' } as any, approver.id))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the target is a phantom member of another team (BUG-01)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 500, username: 'phantom_abc', email: 'phantom_abc@phantom.local', isPhantom: true });

      await expect(service.addMember(activeTeam.id, { username: 'phantom_abc', role: 'DEVELOPER' } as any, creator.id))
        .rejects.toThrow(NotFoundException);
      expect(mockPrismaService.teamMember.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the invited username does not exist and is not an email', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValueOnce(admin);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.addMember(activeTeam.id, { username: 'ghost', role: 'DEVELOPER' } as any, creator.id))
        .rejects.toThrow(NotFoundException);
      expect(mockInvitesService.createInvite).not.toHaveBeenCalled();
    });

    it('invites an unregistered email instead of 404ing, and returns the InvitesService result', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValueOnce(admin);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockInvitesService.createInvite.mockResolvedValue({ id: 1, email: 'ghost@example.com', token: 'abc' });

      const result = await service.addMember(activeTeam.id, { username: 'ghost@example.com', role: 'TESTER' } as any, creator.id);

      expect(mockInvitesService.createInvite).toHaveBeenCalledWith(
        activeTeam.id,
        { email: 'ghost@example.com', role: 'TESTER' },
        creator.id
      );
      expect(result).toEqual({ id: 1, email: 'ghost@example.com', token: 'abc' });
    });

    it('looks up an existing user by email case-insensitively and creates a PENDING membership, not an invite (BUG-19)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(null);
      mockPrismaService.user.findFirst.mockResolvedValue(invitee);
      mockPrismaService.teamMember.create.mockResolvedValue({ id: 99, status: 'PENDING' });

      await service.addMember(activeTeam.id, { username: '  INVITEE@Example.COM ', role: 'DEVELOPER' } as any, creator.id);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { username: 'INVITEE@Example.COM' },
              { email: { equals: 'INVITEE@Example.COM', mode: 'insensitive' } },
            ],
          },
        })
      );
      expect(mockInvitesService.createInvite).not.toHaveBeenCalled();
      expect(mockPrismaService.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: invitee.id, status: 'PENDING' }) })
      );
    });

    it('lowercases an unregistered email before creating the invite (BUG-19)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValueOnce(admin);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockInvitesService.createInvite.mockResolvedValue({ id: 1 });

      await service.addMember(activeTeam.id, { username: 'Ghost@Example.COM', role: 'TESTER' } as any, creator.id);

      expect(mockInvitesService.createInvite).toHaveBeenCalledWith(
        activeTeam.id,
        { email: 'ghost@example.com', role: 'TESTER' },
        creator.id
      );
    });

    it('throws ConflictException with a distinct message when the user already has a pending invite', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique
        .mockResolvedValueOnce(admin) // requester check
        .mockResolvedValueOnce({ status: 'PENDING' }); // existing membership check
      mockPrismaService.user.findFirst.mockResolvedValue(invitee);

      await expect(service.addMember(activeTeam.id, { username: invitee.username, role: 'DEVELOPER' } as any, creator.id))
        .rejects.toThrow(ConflictException);
    });

    it('creates a PENDING invite (does not activate membership immediately)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(null);
      mockPrismaService.user.findFirst.mockResolvedValue(invitee);
      mockPrismaService.teamMember.create.mockResolvedValue({ id: 99, status: 'PENDING' });

      await service.addMember(activeTeam.id, { username: invitee.username, role: 'DEVELOPER' } as any, creator.id);

      expect(mockPrismaService.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: invitee.id, teamId: activeTeam.id, status: 'PENDING' }),
        })
      );
    });
  });

  describe('getTeamMembers', () => {
    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.getTeamMembers(999, creator.id)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a user who is not a member of the team (BUG-03)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.getTeamMembers(mockTeam.id, 999)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.teamMember.findMany).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for a member whose invite is still PENDING', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ userId: 5, teamId: mockTeam.id, status: 'PENDING' });

      await expect(service.getTeamMembers(mockTeam.id, 5)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.teamMember.findMany).not.toHaveBeenCalled();
    });

    it('returns the members to an ACTIVE member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ userId: creator.id, teamId: mockTeam.id, status: 'ACTIVE' });
      mockPrismaService.teamMember.findMany.mockResolvedValue([{ id: 1 }]);

      await expect(service.getTeamMembers(mockTeam.id, creator.id)).resolves.toEqual([{ id: 1 }]);
    });
  });

  describe('acceptMemberInvite', () => {
    const pendingInvite = { id: 30, userId: 5, teamId: mockTeam.id, status: 'PENDING' };

    it('throws NotFoundException when the invite does not exist', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue(null);

      await expect(service.acceptMemberInvite(mockTeam.id, pendingInvite.id, 5)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when someone other than the invitee tries to accept', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue(pendingInvite);

      await expect(service.acceptMemberInvite(mockTeam.id, pendingInvite.id, 999)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when the invite is no longer PENDING', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue({ ...pendingInvite, status: 'ACTIVE' });

      await expect(service.acceptMemberInvite(mockTeam.id, pendingInvite.id, 5)).rejects.toThrow(ConflictException);
    });

    it('activates the membership when the invitee accepts', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue(pendingInvite);
      mockPrismaService.teamMember.update.mockResolvedValue({ ...pendingInvite, status: 'ACTIVE' });

      await service.acceptMemberInvite(mockTeam.id, pendingInvite.id, 5);

      expect(mockPrismaService.teamMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: pendingInvite.id }, data: { status: 'ACTIVE' } })
      );
    });
  });

  describe('declineMemberInvite', () => {
    const pendingInvite = { id: 30, userId: 5, teamId: mockTeam.id, status: 'PENDING' };

    it('throws NotFoundException when the invite does not exist', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue(null);

      await expect(service.declineMemberInvite(mockTeam.id, pendingInvite.id, 5)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the invite is no longer PENDING', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue({ ...pendingInvite, status: 'ACTIVE' });

      await expect(service.declineMemberInvite(mockTeam.id, pendingInvite.id, 5)).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when requester is neither the invitee nor a team admin', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue(pendingInvite);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ isAdmin: false, status: 'ACTIVE' });

      await expect(service.declineMemberInvite(mockTeam.id, pendingInvite.id, 999)).rejects.toThrow(ForbiddenException);
    });

    it('allows the invitee to decline their own invite', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue(pendingInvite);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      mockPrismaService.teamMember.delete.mockResolvedValue(pendingInvite);

      const result = await service.declineMemberInvite(mockTeam.id, pendingInvite.id, pendingInvite.userId);

      expect(mockPrismaService.teamMember.delete).toHaveBeenCalledWith({ where: { id: pendingInvite.id } });
      expect(result).toEqual({ success: true });
    });

    it('allows a team admin to cancel a pending invite', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue(pendingInvite);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ isAdmin: true, status: 'ACTIVE' });
      mockPrismaService.teamMember.delete.mockResolvedValue(pendingInvite);

      const result = await service.declineMemberInvite(mockTeam.id, pendingInvite.id, creator.id);

      expect(mockPrismaService.teamMember.delete).toHaveBeenCalledWith({ where: { id: pendingInvite.id } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('removeMember', () => {
    const admin = { id: 1, userId: creator.id, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER', status: 'ACTIVE' };
    const nonAdmin = { userId: approver.id, teamId: mockTeam.id, isAdmin: false, role: 'DEVELOPER', status: 'ACTIVE' };
    const targetRegular = { id: 20, userId: 5, teamId: mockTeam.id, isAdmin: false, role: 'DEVELOPER', status: 'ACTIVE' };
    const targetAdmin = { id: 21, userId: 6, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER', status: 'ACTIVE' };

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.removeMember(mockTeam.id, targetRegular.id, creator.id)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not an admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.removeMember(mockTeam.id, targetRegular.id, approver.id)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the target member is not in this team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(null);

      await expect(service.removeMember(mockTeam.id, 999, creator.id)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when removing the only admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetAdmin);
      mockPrismaService.teamMember.count.mockResolvedValue(1);

      await expect(service.removeMember(mockTeam.id, targetAdmin.id, creator.id)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.teamMember.delete).not.toHaveBeenCalled();
    });

    it('counts only ACTIVE admins when guarding the last admin (BUG-11 route A)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetAdmin);
      mockPrismaService.teamMember.count.mockResolvedValue(1);

      await expect(service.removeMember(mockTeam.id, targetAdmin.id, creator.id)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.teamMember.count).toHaveBeenCalledWith({
        where: { teamId: mockTeam.id, isAdmin: true, status: 'ACTIVE' },
      });
      expect(mockPrismaService.teamMember.delete).not.toHaveBeenCalled();
    });

    // BUG-52
    it('cleans up the removed member\'s Google Calendar events after the removal', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetRegular);
      mockPrismaService.teamMember.delete.mockResolvedValue(targetRegular);

      await expect(service.removeMember(mockTeam.id, targetRegular.id, creator.id)).resolves.toEqual({ success: true });

      expect(mockGoogleCalendarService.removeMemberFromTeam).toHaveBeenCalledWith(targetRegular.userId, mockTeam.id);
    });

    it('does not touch Google Calendar when the removal is rejected (BUG-52)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetAdmin);
      mockPrismaService.teamMember.count.mockResolvedValue(1);

      await expect(service.removeMember(mockTeam.id, targetAdmin.id, creator.id)).rejects.toThrow(ConflictException);
      expect(mockGoogleCalendarService.removeMemberFromTeam).not.toHaveBeenCalled();
    });

    it('does not fail the removal when the Google Calendar cleanup throws (BUG-52)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetRegular);
      mockPrismaService.teamMember.delete.mockResolvedValue(targetRegular);
      mockGoogleCalendarService.removeMemberFromTeam.mockRejectedValueOnce(new Error('google is down'));

      await expect(service.removeMember(mockTeam.id, targetRegular.id, creator.id)).resolves.toEqual({ success: true });
    });

    it('lets an admin remove a PENDING admin without any last-admin check', async () => {
      const pendingAdmin = { ...targetAdmin, status: 'PENDING' };
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(pendingAdmin);
      mockPrismaService.teamMember.delete.mockResolvedValue(pendingAdmin);

      await expect(service.removeMember(mockTeam.id, pendingAdmin.id, creator.id)).resolves.toEqual({ success: true });
      expect(mockPrismaService.teamMember.count).not.toHaveBeenCalled();
    });

    it('runs the check and delete inside one transaction holding the team row lock (BUG-11 route B)', async () => {
      const order: string[] = [];
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetAdmin);
      mockPrismaService.$queryRaw.mockImplementationOnce(async () => { order.push('lock'); return []; });
      mockPrismaService.teamMember.count.mockImplementationOnce(async () => { order.push('count'); return 2; });
      mockPrismaService.teamMember.delete.mockImplementationOnce(async () => { order.push('delete'); return targetAdmin; });

      await service.removeMember(mockTeam.id, targetAdmin.id, creator.id);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['lock', 'count', 'delete']);
    });

    it('removes a regular member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetRegular);
      mockPrismaService.teamMember.delete.mockResolvedValue(targetRegular);

      const result = await service.removeMember(mockTeam.id, targetRegular.id, creator.id);

      expect(mockPrismaService.teamMember.delete).toHaveBeenCalledWith({ where: { id: targetRegular.id } });
      expect(result).toEqual({ success: true });
    });

    it('removes an admin when another admin remains', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetAdmin);
      mockPrismaService.teamMember.count.mockResolvedValue(2);
      mockPrismaService.teamMember.delete.mockResolvedValue(targetAdmin);

      const result = await service.removeMember(mockTeam.id, targetAdmin.id, creator.id);

      expect(mockPrismaService.teamMember.delete).toHaveBeenCalledWith({ where: { id: targetAdmin.id } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('updateMember', () => {
    const admin = { id: 1, userId: creator.id, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER', status: 'ACTIVE' };
    const targetAdmin = { id: 21, userId: 6, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER', status: 'ACTIVE' };

    beforeEach(() => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(targetAdmin);
    });

    it('rejects demoting the only ACTIVE admin even if a PENDING admin exists (BUG-11 route A)', async () => {
      // 1 ACTIVE admin + 1 PENDING admin: the DB-side count (status: ACTIVE) returns 1.
      mockPrismaService.teamMember.count.mockResolvedValue(1);

      await expect(service.updateMember(mockTeam.id, targetAdmin.id, { isAdmin: false }, creator.id))
        .rejects.toThrow(ConflictException);
      expect(mockPrismaService.teamMember.count).toHaveBeenCalledWith({
        where: { teamId: mockTeam.id, isAdmin: true, status: 'ACTIVE' },
      });
      expect(mockPrismaService.teamMember.update).not.toHaveBeenCalled();
    });

    it('demotes an admin under the team lock when another ACTIVE admin remains (BUG-11 route B)', async () => {
      const order: string[] = [];
      mockPrismaService.$queryRaw.mockImplementationOnce(async () => { order.push('lock'); return []; });
      mockPrismaService.teamMember.count.mockImplementationOnce(async () => { order.push('count'); return 2; });
      mockPrismaService.teamMember.update.mockImplementationOnce(async () => { order.push('update'); return { id: targetAdmin.id }; });

      await service.updateMember(mockTeam.id, targetAdmin.id, { isAdmin: false }, creator.id);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['lock', 'count', 'update']);
    });

    it('does not need the lock or count for a role-only change', async () => {
      mockPrismaService.teamMember.update.mockResolvedValue({ id: targetAdmin.id });

      await service.updateMember(mockTeam.id, targetAdmin.id, { role: 'TESTER' as any }, creator.id);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.teamMember.count).not.toHaveBeenCalled();
    });

    it('demotes a PENDING admin without a last-admin check', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue({ ...targetAdmin, status: 'PENDING' });
      mockPrismaService.teamMember.update.mockResolvedValue({ id: targetAdmin.id });

      await service.updateMember(mockTeam.id, targetAdmin.id, { isAdmin: false }, creator.id);

      expect(mockPrismaService.teamMember.count).not.toHaveBeenCalled();
      expect(mockPrismaService.teamMember.update).toHaveBeenCalled();
    });
  });

  describe('updateTeam', () => {
    const activeTeam = { ...mockTeam, status: 'ACTIVE' };
    const admin = { userId: creator.id, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER', status: 'ACTIVE' };

    it('throws ForbiddenException when the requester is not an admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...admin, isAdmin: false });

      await expect(service.updateTeam(mockTeam.id, { name: 'X' }, creator.id)).rejects.toThrow(ForbiddenException);
    });

    // BUG-39
    it('throws NotFoundException (not 403) when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.updateTeam(999999, { name: 'X' }, creator.id)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.team.update).not.toHaveBeenCalled();
    });

    it('rejects a non-string mainOffice with BadRequestException (BUG-15)', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);

      await expect(service.updateTeam(mockTeam.id, { mainOffice: 5 as any }, creator.id)).rejects.toThrow(BadRequestException);
    });

    it('rejects editing a team that is still PENDING_APPROVAL (BUG-36)', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam); // status: PENDING_APPROVAL

      await expect(service.updateTeam(mockTeam.id, { name: 'New' }, creator.id)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.team.update).not.toHaveBeenCalled();
    });

    it.each(['', '   ', '\t\n'])('rejects an empty/whitespace name %j (BUG-36)', async (name) => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);

      await expect(service.updateTeam(mockTeam.id, { name }, creator.id)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.team.update).not.toHaveBeenCalled();
    });

    it('trims the name and saves it on an ACTIVE team', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.team.update.mockResolvedValue({ ...activeTeam, name: 'New name' });

      await service.updateTeam(mockTeam.id, { name: '  New name  ', mainOffice: 'TLV' }, creator.id);

      expect(mockPrismaService.team.update).toHaveBeenCalledWith({
        where: { id: mockTeam.id },
        data: { name: 'New name', mainOffice: 'TLV' },
      });
    });

    // BUG-52
    it('syncs a real rename to the team\'s Google calendars (using the trimmed name)', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.team.update.mockResolvedValue({ ...activeTeam, name: 'New name' });

      await service.updateTeam(mockTeam.id, { name: '  New name  ' }, creator.id);

      expect(mockGoogleCalendarService.syncTeamRenamed).toHaveBeenCalledWith(mockTeam.id, 'New name');
    });

    it('does not touch Google Calendar when the name is unchanged or not sent (BUG-52)', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.team.update.mockResolvedValue(activeTeam);

      await service.updateTeam(mockTeam.id, { name: activeTeam.name, mainOffice: 'TLV' }, creator.id);
      await service.updateTeam(mockTeam.id, { mainOffice: 'TLV' }, creator.id);

      expect(mockGoogleCalendarService.syncTeamRenamed).not.toHaveBeenCalled();
    });

    it('does not fail the team edit when the Google Calendar rename sync throws (BUG-52)', async () => {
      const renamed = { ...activeTeam, name: 'New name' };
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.team.update.mockResolvedValue(renamed);
      mockGoogleCalendarService.syncTeamRenamed.mockRejectedValueOnce(new Error('google is down'));

      await expect(service.updateTeam(mockTeam.id, { name: 'New name' }, creator.id)).resolves.toEqual(renamed);
    });

    it('leaves the name untouched when only mainOffice is sent', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.team.update.mockResolvedValue(activeTeam);

      await service.updateTeam(mockTeam.id, { mainOffice: 'TLV' }, creator.id);

      expect(mockPrismaService.team.update).toHaveBeenCalledWith({
        where: { id: mockTeam.id },
        data: { name: undefined, mainOffice: 'TLV' },
      });
    });
  });

  describe('createPhantomMember', () => {
    const admin = { userId: creator.id, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER', status: 'ACTIVE' };
    const nonAdmin = { userId: approver.id, teamId: mockTeam.id, isAdmin: false, role: 'DEVELOPER', status: 'ACTIVE' };
    const dto = { firstName: 'Phanto', lastName: 'Mm' };

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.createPhantomMember(mockTeam.id, dto as any, creator.id)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the team is still PENDING_APPROVAL (BUG-36)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);

      await expect(service.createPhantomMember(mockTeam.id, dto as any, creator.id)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester is neither admin nor team leader', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({ ...mockTeam, status: 'ACTIVE' });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.createPhantomMember(mockTeam.id, dto as any, approver.id)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('creates a User (isPhantom, password:null, auto-generated username/email) and a TeamMember in one nested write', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({ ...mockTeam, status: 'ACTIVE' });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.user.create.mockImplementation(({ data }: any) => Promise.resolve({
        id: 500,
        username: data.username,
        email: data.email,
        password: data.password,
        isPhantom: data.isPhantom,
        firstName: data.firstName,
        lastName: data.lastName,
        members: [{ id: 55, teamId: mockTeam.id, role: data.members.create.role, isAdmin: false, status: 'ACTIVE' }],
      }));

      const result = await service.createPhantomMember(mockTeam.id, dto as any, admin.userId);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: expect.stringMatching(/^phantom_[0-9a-f]{16}$/),
            email: expect.stringMatching(/^phantom_[0-9a-f]{16}@phantom\.local$/),
            password: null,
            isPhantom: true,
            firstName: dto.firstName,
            lastName: dto.lastName,
            members: { create: expect.objectContaining({ teamId: mockTeam.id, role: 'DEVELOPER', isAdmin: false, status: 'ACTIVE' }) },
          }),
        })
      );
      expect(result.isPhantom).toBe(true);
      expect((result as any).password).toBeUndefined();
    });

    it('honors an explicit role instead of defaulting to DEVELOPER', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({ ...mockTeam, status: 'ACTIVE' });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.user.create.mockResolvedValue({ id: 501, isPhantom: true, members: [] });

      await service.createPhantomMember(mockTeam.id, { ...dto, role: 'TESTER' } as any, admin.userId);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            members: { create: expect.objectContaining({ role: 'TESTER' }) },
          }),
        })
      );
    });
  });
});
