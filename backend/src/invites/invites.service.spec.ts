import { Test, TestingModule } from '@nestjs/testing';
import { InvitesService } from './invites.service';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('InvitesService', () => {
  let service: InvitesService;

  const team = { id: 10, name: 'Core Team', status: 'ACTIVE' };
  const admin = { userId: 1, teamId: team.id, isAdmin: true, status: 'ACTIVE' };
  const nonAdmin = { userId: 2, teamId: team.id, isAdmin: false, status: 'ACTIVE' };
  const requester = { id: 1, username: 'creator', firstName: 'Cre', lastName: 'Ator' };

  const mockPrismaService = {
    team: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    teamInvite: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    // Interactive transactions: run the callback against the same mock client.
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockPrismaService)),
  };

  const mockEmailService = {
    sendTeamJoinInvite: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<InvitesService>(InvitesService);
    mockPrismaService.teamInvite.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockPrismaService.teamInvite.updateMany.mockReset();
  });

  describe('createInvite', () => {
    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.createInvite(team.id, {}, admin.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not an admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.createInvite(team.id, {}, nonAdmin.userId)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when a still-valid personal invite already exists for that email', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamInvite.findFirst.mockResolvedValue({
        isRevoked: false, expiresAt: null, maxUses: 1, useCount: 0,
      });

      await expect(service.createInvite(team.id, { email: 'x@example.com' }, admin.userId)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.teamInvite.create).not.toHaveBeenCalled();
    });

    it('allows re-inviting an email whose previous invite is no longer valid', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamInvite.findFirst.mockResolvedValue({
        isRevoked: true, expiresAt: null, maxUses: 1, useCount: 0,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(requester);
      mockPrismaService.teamInvite.create.mockResolvedValue({ id: 1, token: 'tok', email: 'x@example.com' });

      await service.createInvite(team.id, { email: 'x@example.com' }, admin.userId);

      expect(mockPrismaService.teamInvite.create).toHaveBeenCalled();
    });

    it('creates a personal invite with maxUses forced to 1 and sends an email', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamInvite.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(requester);
      mockPrismaService.teamInvite.create.mockResolvedValue({ id: 1, token: 'tok123', email: 'x@example.com' });

      await service.createInvite(team.id, { email: 'x@example.com', role: 'TESTER' as any }, admin.userId);

      expect(mockPrismaService.teamInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'x@example.com', role: 'TESTER', maxUses: 1, teamId: team.id }),
        })
      );
      expect(mockEmailService.sendTeamJoinInvite).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'x@example.com', teamName: team.name, token: 'tok123' })
      );
    });

    it('creates a generic link (no email) without sending any email, honoring maxUses/expiresAt', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.user.findUnique.mockResolvedValue(requester);
      mockPrismaService.teamInvite.create.mockResolvedValue({ id: 2, token: 'tok456', email: null });

      await service.createInvite(team.id, { maxUses: 5, expiresAt: '2026-12-31T00:00:00.000Z' }, admin.userId);

      expect(mockPrismaService.teamInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: null, maxUses: 5, expiresAt: new Date('2026-12-31T00:00:00.000Z') }),
        })
      );
      expect(mockEmailService.sendTeamJoinInvite).not.toHaveBeenCalled();
    });

    it('stores a trimmed admin-facing name for a generic link, or null when omitted', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.user.findUnique.mockResolvedValue(requester);
      mockPrismaService.teamInvite.create.mockResolvedValue({ id: 3, token: 'tok789', name: 'לינק לצוות פיתוח' });

      await service.createInvite(team.id, { name: '  לינק לצוות פיתוח  ' }, admin.userId);

      expect(mockPrismaService.teamInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'לינק לצוות פיתוח' }) })
      );

      await service.createInvite(team.id, {}, admin.userId);

      expect(mockPrismaService.teamInvite.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: null }) })
      );
    });

    it('rejects an expiresAt date that is already in the past', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);

      await expect(
        service.createInvite(team.id, { expiresAt: '2020-01-01T00:00:00.000Z' }, admin.userId)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.teamInvite.create).not.toHaveBeenCalled();
    });
  });

  describe('getInvite', () => {
    it('throws NotFoundException when the token does not exist', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(null);

      await expect(service.getInvite('missing')).rejects.toThrow(NotFoundException);
    });

    it('reports valid:true for a usable invite', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({
        isRevoked: false, expiresAt: null, maxUses: null, useCount: 0, email: 'x@example.com',
        team: { name: 'Core Team' },
      });

      const result = await service.getInvite('tok');

      expect(result).toEqual({
        teamName: 'Core Team', email: 'x@example.com', valid: true, reason: undefined,
        type: 'join', prefill: undefined,
      });
    });

    it.each([
      ['revoked', { isRevoked: true, expiresAt: null, maxUses: null, useCount: 0 }, 'ההזמנה בוטלה'],
      ['expired', { isRevoked: false, expiresAt: new Date('2000-01-01'), maxUses: null, useCount: 0 }, 'ההזמנה פגה'],
      ['exhausted', { isRevoked: false, expiresAt: null, maxUses: 1, useCount: 1 }, 'ההזמנה כבר נוצלה'],
    ])('reports valid:false with the right reason when %s', async (_label, invite, expectedReason) => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...invite, email: null, team: { name: 'Core Team' } });

      const result = await service.getInvite('tok');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe(expectedReason);
    });

    it('reports type:phantomConversion with a firstName/lastName prefill for a conversion link', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({
        isRevoked: false, expiresAt: null, maxUses: 1, useCount: 0, email: null,
        convertsMemberId: 7, team: { name: 'Core Team' },
        convertsMember: { user: { firstName: 'Phanto', lastName: 'Mm' } },
      });

      const result = await service.getInvite('tok');

      expect(result.type).toBe('phantomConversion');
      expect(result.prefill).toEqual({ firstName: 'Phanto', lastName: 'Mm' });
    });
  });

  describe('consumeInvite', () => {
    const validInvite = {
      id: 5, token: 'tok', teamId: team.id, email: null, role: 'DEVELOPER',
      isRevoked: false, expiresAt: null, maxUses: null, useCount: 0,
    };
    const joiningUser = { id: 99, email: 'joiner@example.com' };

    it('throws NotFoundException when the token does not exist', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(null);

      await expect(service.consumeInvite('missing', joiningUser)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the invite is no longer valid', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...validInvite, isRevoked: true });

      await expect(service.consumeInvite('tok', joiningUser)).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when the invite is locked to a different email', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...validInvite, email: 'someone-else@example.com' });

      await expect(service.consumeInvite('tok', joiningUser)).rejects.toThrow(ForbiddenException);
    });

    it('accepts a case-insensitive email match for a personal invite', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...validInvite, email: 'Joiner@Example.com' });
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      mockPrismaService.teamMember.create.mockResolvedValue({ id: 1 });

      await expect(service.consumeInvite('tok', joiningUser)).resolves.toBeDefined();
    });

    it('throws ConflictException when the team is not ACTIVE', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(validInvite);
      mockPrismaService.team.findUnique.mockResolvedValue({ ...team, status: 'PENDING_APPROVAL' });

      await expect(service.consumeInvite('tok', joiningUser)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the user is already a member', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(validInvite);
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ id: 1 });

      await expect(service.consumeInvite('tok', joiningUser)).rejects.toThrow(ConflictException);
    });

    it('creates an ACTIVE membership and increments useCount on success', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(validInvite);
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      mockPrismaService.teamMember.create.mockResolvedValue({ id: 1, status: 'ACTIVE' });

      const result = await service.consumeInvite('tok', joiningUser);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teamId: team.id, userId: joiningUser.id, isAdmin: false, status: 'ACTIVE' }),
        })
      );
      expect(result).toEqual({ id: 1, status: 'ACTIVE' });
    });

    it('claims the use atomically with a useCount < maxUses guard (BUG-06)', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...validInvite, maxUses: 3, useCount: 2 });
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      mockPrismaService.teamMember.create.mockResolvedValue({ id: 1 });

      await service.consumeInvite('tok', joiningUser);

      expect(mockPrismaService.teamInvite.updateMany).toHaveBeenCalledWith({
        where: { id: validInvite.id, isRevoked: false, useCount: { lt: 3 } },
        data: { useCount: { increment: 1 } },
      });
    });

    it('omits the useCount guard for an unlimited invite', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(validInvite);
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      mockPrismaService.teamMember.create.mockResolvedValue({ id: 1 });

      await service.consumeInvite('tok', joiningUser);

      expect(mockPrismaService.teamInvite.updateMany).toHaveBeenCalledWith({
        where: { id: validInvite.id, isRevoked: false },
        data: { useCount: { increment: 1 } },
      });
    });

    it('throws ConflictException and creates no membership when a concurrent consumer took the last use (BUG-06)', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...validInvite, maxUses: 1, useCount: 0 });
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      mockPrismaService.teamInvite.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.consumeInvite('tok', joiningUser)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.teamMember.create).not.toHaveBeenCalled();
    });
  });

  describe('listInvites / revokeInvite', () => {
    it('listInvites throws ForbiddenException for a non-admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.listInvites(team.id, nonAdmin.userId)).rejects.toThrow(ForbiddenException);
    });

    it('revokeInvite throws NotFoundException when the invite does not belong to the team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamInvite.findFirst.mockResolvedValue(null);

      await expect(service.revokeInvite(team.id, 999, admin.userId)).rejects.toThrow(NotFoundException);
    });

    it('revokeInvite sets isRevoked: true', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamInvite.findFirst.mockResolvedValue({ id: 7, teamId: team.id });
      mockPrismaService.teamInvite.update.mockResolvedValue({ id: 7, isRevoked: true });

      await service.revokeInvite(team.id, 7, admin.userId);

      expect(mockPrismaService.teamInvite.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { isRevoked: true },
      });
    });
  });

  describe('createPhantomConversionInvite', () => {
    const phantomMember = { id: 50, teamId: team.id, userId: 500, user: { id: 500, isPhantom: true } };

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.createPhantomConversionInvite(team.id, phantomMember.id, {}, admin.userId))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not an admin/team-leader', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.createPhantomConversionInvite(team.id, phantomMember.id, {}, nonAdmin.userId))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the target member is not in this team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(null);

      await expect(service.createPhantomConversionInvite(team.id, 999, {}, admin.userId))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the target member is not (or no longer) a phantom', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue({ ...phantomMember, user: { id: 500, isPhantom: false } });

      await expect(service.createPhantomConversionInvite(team.id, phantomMember.id, {}, admin.userId))
        .rejects.toThrow(ConflictException);
      expect(mockPrismaService.teamInvite.create).not.toHaveBeenCalled();
    });

    it('creates a single-use, email-less conversion invite linked to the phantom member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(phantomMember);
      mockPrismaService.teamInvite.create.mockResolvedValue({ id: 1, token: 'convtok' });

      await service.createPhantomConversionInvite(team.id, phantomMember.id, {}, admin.userId);

      expect(mockPrismaService.teamInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: team.id,
          convertsMemberId: phantomMember.id,
          email: null,
          maxUses: 1,
          createdById: admin.userId,
          expiresAt: null,
        }),
      });
    });
  });

  describe('consumePhantomConversionInvite', () => {
    const conversionInvite = {
      id: 8, token: 'convtok', teamId: team.id, convertsMemberId: 50,
      isRevoked: false, expiresAt: null, maxUses: 1, useCount: 0,
    };
    const phantomMember = { id: 50, teamId: team.id, userId: 500 };
    const phantomUser = { id: 500, username: 'phantom_abc', email: 'phantom_abc@phantom.local', isPhantom: true, firstName: 'Phanto', lastName: null };
    const conversionDto = { username: 'realuser', email: 'real@example.com', password: 'pw123456' };

    it('throws NotFoundException when the token does not exist', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(null);

      await expect(service.consumePhantomConversionInvite('missing', conversionDto)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the invite is no longer valid', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...conversionInvite, isRevoked: true });

      await expect(service.consumePhantomConversionInvite('convtok', conversionDto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the invite is not a conversion invite', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...conversionInvite, convertsMemberId: null });

      await expect(service.consumePhantomConversionInvite('convtok', conversionDto)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the phantom belongs to a different team than the invite (BUG-01)', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(conversionInvite);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...phantomMember, teamId: team.id + 1 });

      await expect(service.consumePhantomConversionInvite('convtok', conversionDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the phantom has already been converted (double-conversion blocked)', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(conversionInvite);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(phantomMember);
      mockPrismaService.user.findUnique.mockResolvedValue({ ...phantomUser, isPhantom: false });

      await expect(service.consumePhantomConversionInvite('convtok', conversionDto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when username/email is taken by someone other than the phantom itself', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(conversionInvite);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(phantomMember);
      mockPrismaService.user.findUnique.mockResolvedValue(phantomUser);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 999 });

      await expect(service.consumePhantomConversionInvite('convtok', conversionDto)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ username: conversionDto.username }, { email: conversionDto.email }], NOT: { id: phantomUser.id } },
      });
    });

    it('converts the phantom in place, increments useCount, and returns a valid accessToken', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(conversionInvite);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(phantomMember);
      mockPrismaService.user.findUnique.mockResolvedValue(phantomUser);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({
        ...phantomUser, username: conversionDto.username, email: conversionDto.email, password: 'hashed', isPhantom: false,
      });

      const result = await service.consumePhantomConversionInvite('convtok', conversionDto);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user).toEqual(
        expect.objectContaining({ username: conversionDto.username, email: conversionDto.email, isPhantom: false })
      );
      expect((result.user as any).password).toBeUndefined();
    });
  });
});
