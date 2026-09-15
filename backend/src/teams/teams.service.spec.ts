import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { InvitesService } from '../invites/invites.service';
import {
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
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEmailService = {
    sendTeamApprovalRequest: jest.fn().mockResolvedValue(undefined),
  };

  const mockInvitesService = {
    createInvite: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: InvitesService, useValue: mockInvitesService },
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
    const admin = { userId: creator.id, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER' };
    const nonAdmin = { userId: approver.id, teamId: mockTeam.id, isAdmin: false, role: 'DEVELOPER' };
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
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ isAdmin: false });

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
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ isAdmin: true });
      mockPrismaService.teamMember.delete.mockResolvedValue(pendingInvite);

      const result = await service.declineMemberInvite(mockTeam.id, pendingInvite.id, creator.id);

      expect(mockPrismaService.teamMember.delete).toHaveBeenCalledWith({ where: { id: pendingInvite.id } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('removeMember', () => {
    const admin = { id: 1, userId: creator.id, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER' };
    const nonAdmin = { userId: approver.id, teamId: mockTeam.id, isAdmin: false, role: 'DEVELOPER' };
    const targetRegular = { id: 20, userId: 5, teamId: mockTeam.id, isAdmin: false, role: 'DEVELOPER' };
    const targetAdmin = { id: 21, userId: 6, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER' };

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

  describe('createPhantomMember', () => {
    const admin = { userId: creator.id, teamId: mockTeam.id, isAdmin: true, role: 'TEAM_LEADER' };
    const nonAdmin = { userId: approver.id, teamId: mockTeam.id, isAdmin: false, role: 'DEVELOPER' };
    const dto = { firstName: 'Phanto', lastName: 'Mm' };

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.createPhantomMember(mockTeam.id, dto as any, creator.id)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is neither admin nor team leader', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.createPhantomMember(mockTeam.id, dto as any, approver.id)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('creates a User (isPhantom, password:null, auto-generated username/email) and a TeamMember in one nested write', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
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
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
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
