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

    describe('input validation & expiry (BUG-15, BUG-32)', () => {
      beforeEach(() => {
        mockPrismaService.team.findUnique.mockResolvedValue(team);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
        mockPrismaService.teamInvite.findFirst.mockResolvedValue(null);
        mockPrismaService.user.findUnique.mockResolvedValue(requester);
        mockPrismaService.teamInvite.create.mockImplementation(async ({ data }: any) => ({ id: 1, ...data }));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it.each([
        ['maxUses 0', { maxUses: 0 }],
        ['negative maxUses', { maxUses: -1 }],
        ['fractional maxUses', { maxUses: 1.5 }],
        ['string maxUses', { maxUses: '5' }],
        ['over-Int32 maxUses', { maxUses: 99999999999 }],
        ['unparseable expiresAt', { expiresAt: 'not-a-date' }],
        ['impossible date-only expiresAt', { expiresAt: '2026-02-31' }],
        ['non-string expiresAt', { expiresAt: 12345 }],
        ['unknown role', { role: 'BOSS' }],
        ['non-string email', { email: 5 }],
        ['non-string name', { name: {} }],
      ])('rejects %s with BadRequestException and creates nothing', async (_label, dto) => {
        await expect(service.createInvite(team.id, dto as any, admin.userId)).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.teamInvite.create).not.toHaveBeenCalled();
      });

      it('accepts a positive maxUses', async () => {
        await service.createInvite(team.id, { maxUses: 5 }, admin.userId);

        expect(mockPrismaService.teamInvite.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ maxUses: 5 }),
        });
      });

      it('accepts "today" as a date-only expiresAt and stores the END of that day in Israel time (summer, UTC+3)', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-10-05T10:00:00Z'));

        await service.createInvite(team.id, { expiresAt: '2026-10-05' }, admin.userId);

        const { expiresAt } = mockPrismaService.teamInvite.create.mock.calls[0][0].data;
        expect(expiresAt.toISOString()).toBe('2026-10-05T20:59:59.999Z');
      });

      it('stores the end of the day in winter time (UTC+2) for a date-only expiresAt', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-12-01T10:00:00Z'));

        await service.createInvite(team.id, { expiresAt: '2026-12-10' }, admin.userId);

        const { expiresAt } = mockPrismaService.teamInvite.create.mock.calls[0][0].data;
        expect(expiresAt.toISOString()).toBe('2026-12-10T21:59:59.999Z');
      });

      it('still rejects a date-only expiresAt for a day that has already ended', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-10-05T10:00:00Z'));

        await expect(service.createInvite(team.id, { expiresAt: '2026-10-04' }, admin.userId)).rejects.toThrow(BadRequestException);
      });

      it('takes a full ISO timestamp literally and still requires it to be in the future', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-10-05T10:00:00Z'));

        await expect(service.createInvite(team.id, { expiresAt: '2026-10-05T09:00:00Z' }, admin.userId)).rejects.toThrow(BadRequestException);
        await service.createInvite(team.id, { expiresAt: '2026-10-05T11:00:00Z' }, admin.userId);

        const { expiresAt } = mockPrismaService.teamInvite.create.mock.calls[0][0].data;
        expect(expiresAt.toISOString()).toBe('2026-10-05T11:00:00.000Z');
      });
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

    it('normalizes the invited email to trimmed lowercase for lookup, storage and sending (BUG-19)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamInvite.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(requester);
      mockPrismaService.teamInvite.create.mockResolvedValue({ id: 1, token: 'tokN' });

      await service.createInvite(team.id, { email: '  Mixed.Case@Example.COM ' }, admin.userId);

      expect(mockPrismaService.teamInvite.findFirst).toHaveBeenCalledWith({
        where: { teamId: team.id, email: { equals: 'mixed.case@example.com', mode: 'insensitive' } },
      });
      expect(mockPrismaService.teamInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'mixed.case@example.com', maxUses: 1 }) })
      );
      expect(mockEmailService.sendTeamJoinInvite).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'mixed.case@example.com' })
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

  // BUG-15: the public token comes straight from the URL — malformed tokens are a 400, not a
  // Prisma/Postgres error (e.g. a NUL byte from %00).
  describe('token validation (BUG-15)', () => {
    const badTokens = ['', '   ', 'a\u0000b', 'has space', 'x'.repeat(129), '../etc', undefined, null, 123];

    it.each(badTokens)('getInvite rejects %p with BadRequestException', async (token) => {
      await expect(service.getInvite(token as any)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.teamInvite.findUnique).not.toHaveBeenCalled();
    });

    it.each(badTokens)('consumeInvite rejects %p with BadRequestException', async (token) => {
      await expect(service.consumeInvite(token as any, { id: 1, email: 'a@b.co' })).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.teamInvite.findUnique).not.toHaveBeenCalled();
    });

    it('consumePhantomConversionInvite rejects a malformed token with BadRequestException', async () => {
      await expect(
        service.consumePhantomConversionInvite('a\u0000b', { username: 'u1', email: 'u@example.com', password: 'pw123456' })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.teamInvite.findUnique).not.toHaveBeenCalled();
    });

    it('accepts a real 48-hex-char token (reaches the lookup)', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue(null);

      await expect(service.getInvite('a'.repeat(48))).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.teamInvite.findUnique).toHaveBeenCalled();
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

    it('rejects a phantom-conversion invite and creates no membership (BUG-10)', async () => {
      mockPrismaService.teamInvite.findUnique.mockResolvedValue({ ...validInvite, convertsMemberId: 50, maxUses: 1 });
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.consumeInvite('tok', joiningUser)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.teamInvite.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.teamMember.create).not.toHaveBeenCalled();
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

    it('throws ForbiddenException when the requester is not an admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.createPhantomConversionInvite(team.id, phantomMember.id, {}, nonAdmin.userId))
        .rejects.toThrow(ForbiddenException);
    });

    // BUG-44: list/revoke are admin-only, so creating must be too — otherwise the leader mints
    // a link they can neither see nor revoke.
    it('throws ForbiddenException for a TEAM_LEADER who is not an admin (BUG-44)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...nonAdmin, role: 'TEAM_LEADER' });

      await expect(service.createPhantomConversionInvite(team.id, phantomMember.id, {}, nonAdmin.userId))
        .rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.teamInvite.create).not.toHaveBeenCalled();
    });

    it('rejects an unparseable expiresAt with BadRequestException', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(phantomMember);

      await expect(service.createPhantomConversionInvite(team.id, phantomMember.id, { expiresAt: 'soon' }, admin.userId))
        .rejects.toThrow(BadRequestException);
      expect(mockPrismaService.teamInvite.create).not.toHaveBeenCalled();
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
        where: {
          OR: [{ username: conversionDto.username }, { email: { equals: conversionDto.email, mode: 'insensitive' } }],
          NOT: { id: phantomUser.id },
        },
      });
    });

    // BUG-15: input validation happens before any DB access.
    describe('input validation (BUG-15)', () => {
      const invalidDtos: Array<[string, any]> = [
        ['missing body', undefined],
        ['missing username', { email: 'real@example.com', password: 'pw123456' }],
        ['blank username', { ...conversionDto, username: '   ' }],
        ['non-string username', { ...conversionDto, username: { $ne: 1 } }],
        ['missing email', { username: 'realuser', password: 'pw123456' }],
        ['malformed email', { ...conversionDto, email: 'not-an-email' }],
        ['non-string email', { ...conversionDto, email: 5 }],
        ['missing password', { username: 'realuser', email: 'real@example.com' }],
        ['non-string password', { ...conversionDto, password: 123456 }],
        ['too-short password', { ...conversionDto, password: '123' }],
        ['username that looks like someone else\'s email', { ...conversionDto, username: 'victim@example.com' }],
        ['non-string firstName', { ...conversionDto, firstName: 7 }],
        ['non-string lastName', { ...conversionDto, lastName: {} }],
      ];

      it.each(invalidDtos)('rejects %s with BadRequestException and never touches the DB', async (_name, dto) => {
        await expect(service.consumePhantomConversionInvite('convtok', dto)).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.teamInvite.findUnique).not.toHaveBeenCalled();
        expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      });

      it('accepts a username equal to the email and normalizes email (trim + lowercase)', async () => {
        mockPrismaService.teamInvite.findUnique.mockResolvedValue(conversionInvite);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(phantomMember);
        mockPrismaService.user.findUnique.mockResolvedValue(phantomUser);
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.user.update.mockResolvedValue({ ...phantomUser, isPhantom: false });

        await service.consumePhantomConversionInvite('convtok', {
          username: 'Real@Example.com', email: '  Real@Example.com ', password: 'pw123456',
        });

        expect(mockPrismaService.user.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ username: 'Real@Example.com', email: 'real@example.com' }) })
        );
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
