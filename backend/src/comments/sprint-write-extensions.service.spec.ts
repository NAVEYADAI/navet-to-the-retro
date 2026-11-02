import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SprintWriteExtensionsService } from './sprint-write-extensions.service';
import { PrismaService } from '../prisma.service';
import { israelDayAnchor } from '../common/israel-day';

describe('SprintWriteExtensionsService (feature 13)', () => {
  let service: SprintWriteExtensionsService;

  const sprint = { id: 1, teamId: 100, deletedAt: null, team: { deletedAt: null }, endDate: new Date('2020-01-01T00:00:00Z') };
  const admin = { userId: 20, teamId: 100, isAdmin: true, role: 'DEVELOPER', status: 'ACTIVE' };
  const leader = { userId: 30, teamId: 100, isAdmin: false, role: 'TEAM_LEADER', status: 'ACTIVE' };
  const member = { userId: 10, teamId: 100, isAdmin: false, role: 'DEVELOPER', status: 'ACTIVE' };
  const future = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const mockPrisma = {
    sprint: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn() },
    sprintWriteExtension: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SprintWriteExtensionsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(SprintWriteExtensionsService);
    mockPrisma.sprint.findUnique.mockResolvedValue(sprint);
  });
  afterEach(() => jest.resetAllMocks());

  describe('grant', () => {
    it('lets an admin extend an ACTIVE member; one row per (sprint, member) via upsert', async () => {
      mockPrisma.teamMember.findUnique
        .mockResolvedValueOnce(admin) // requester
        .mockResolvedValueOnce(member); // target
      mockPrisma.sprintWriteExtension.upsert.mockResolvedValue({ id: 9 });
      const expiresAt = future();

      const result = await service.grant(1, { userId: 10, expiresAt }, admin.userId);

      expect(result).toEqual({ id: 9 });
      const call = mockPrisma.sprintWriteExtension.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ sprintId_userId: { sprintId: 1, userId: 10 } });
      expect(call.create).toEqual({ sprintId: 1, userId: 10, grantedById: admin.userId, expiresAt: new Date(expiresAt) });
      expect(call.update).toEqual(expect.objectContaining({ grantedById: admin.userId, expiresAt: new Date(expiresAt) }));
      expect(mockPrisma.sprintWriteExtension.deleteMany).not.toHaveBeenCalled();
    });

    it('a date-only expiry means the end of that day (Israel time)', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValueOnce(admin).mockResolvedValueOnce(member);
      mockPrisma.sprintWriteExtension.upsert.mockResolvedValue({});
      const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      await service.grant(1, { userId: 10, expiresAt: d }, admin.userId);

      const data = mockPrisma.sprintWriteExtension.upsert.mock.calls[0][0].create;
      // 23:59:59.999 Asia/Jerusalem = 20:59:59.999Z (DST) or 21:59:59.999Z
      expect(['20:59:59.999', '21:59:59.999']).toContain(data.expiresAt.toISOString().slice(11, 23));
    });

    describe('30-day cap', () => {
      const dayStr = (daysAhead: number) => {
        const t = new Date(israelDayAnchor().getTime() + daysAhead * 24 * 60 * 60 * 1000);
        return t.toISOString().slice(0, 10);
      };

      it('accepts a date-only value exactly 30 days from today (Israel date)', async () => {
        mockPrisma.teamMember.findUnique.mockResolvedValueOnce(admin).mockResolvedValueOnce(member);
        mockPrisma.sprintWriteExtension.upsert.mockResolvedValue({});
        await service.grant(1, { userId: 10, expiresAt: dayStr(30) }, admin.userId);
        expect(mockPrisma.sprintWriteExtension.upsert).toHaveBeenCalled();
      });

      it.each([
        ['31 days ahead (date-only)', () => dayStr(31)],
        ['a year ahead (ISO)', () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()],
      ])('rejects %s with a Hebrew 400', async (_l, expiresAt) => {
        mockPrisma.teamMember.findUnique.mockResolvedValue(admin);
        await expect(service.grant(1, { userId: 10, expiresAt: expiresAt() }, admin.userId)).rejects.toThrow(
          'אפשר להאריך את חלון הכתיבה עד 30 ימים קדימה בלבד'
        );
        expect(mockPrisma.sprintWriteExtension.upsert).not.toHaveBeenCalled();
      });
    });

    it('only an admin: a team leader / plain member gets 403, an outsider 404', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(leader);
      await expect(service.grant(1, { userId: 10, expiresAt: future() }, leader.userId)).rejects.toThrow(ForbiddenException);
      mockPrisma.teamMember.findUnique.mockResolvedValue(member);
      await expect(service.grant(1, { userId: 10, expiresAt: future() }, member.userId)).rejects.toThrow(ForbiddenException);
      mockPrisma.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.grant(1, { userId: 10, expiresAt: future() }, 999)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sprintWriteExtension.upsert).not.toHaveBeenCalled();
    });

    it('404 when the target is not an ACTIVE member of the team', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValueOnce(admin).mockResolvedValueOnce({ ...member, status: 'PENDING' });
      await expect(service.grant(1, { userId: 10, expiresAt: future() }, admin.userId)).rejects.toThrow(NotFoundException);
      mockPrisma.teamMember.findUnique.mockResolvedValueOnce(admin).mockResolvedValueOnce(null);
      await expect(service.grant(1, { userId: 10, expiresAt: future() }, admin.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sprintWriteExtension.upsert).not.toHaveBeenCalled();
    });

    it.each([
      ['missing userId', { expiresAt: '2099-01-01' }],
      ['string userId', { userId: '10', expiresAt: '2099-01-01' }],
      ['missing expiresAt', { userId: 10 }],
      ['garbage expiresAt', { userId: 10, expiresAt: 'tomorrow' }],
      ['an expiry in the past', { userId: 10, expiresAt: '2020-01-01' }],
    ])('rejects %s with 400', async (_l, dto) => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(admin);
      await expect(service.grant(1, dto as any, admin.userId)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sprintWriteExtension.upsert).not.toHaveBeenCalled();
    });

    it('404 for a deleted sprint', async () => {
      mockPrisma.sprint.findUnique.mockResolvedValue({ ...sprint, deletedAt: new Date() });
      await expect(service.grant(1, { userId: 10, expiresAt: future() }, admin.userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('revoke', () => {
    it('an admin deletes the extension', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(admin);
      mockPrisma.sprintWriteExtension.findFirst.mockResolvedValue({ id: 5, sprintId: 1 });
      mockPrisma.sprintWriteExtension.delete.mockResolvedValue({});

      await service.revoke(1, 5, admin.userId);

      expect(mockPrisma.sprintWriteExtension.findFirst).toHaveBeenCalledWith({ where: { id: 5, sprintId: 1 } });
      expect(mockPrisma.sprintWriteExtension.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('403 for a non-admin, 404 for an extension of another sprint', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(leader);
      await expect(service.revoke(1, 5, leader.userId)).rejects.toThrow(ForbiddenException);
      mockPrisma.teamMember.findUnique.mockResolvedValue(admin);
      mockPrisma.sprintWriteExtension.findFirst.mockResolvedValue(null);
      await expect(service.revoke(1, 5, admin.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sprintWriteExtension.delete).not.toHaveBeenCalled();
    });
  });

  describe('list / getAccess', () => {
    it('an admin sees every active extension, a member only their own', async () => {
      mockPrisma.sprintWriteExtension.findMany.mockResolvedValue([]);
      mockPrisma.teamMember.findUnique.mockResolvedValue(admin);
      await service.list(1, admin.userId);
      expect(mockPrisma.sprintWriteExtension.findMany.mock.calls[0][0].where).toEqual({ sprintId: 1, expiresAt: { gt: expect.any(Date) } });

      mockPrisma.teamMember.findUnique.mockResolvedValue(member);
      await service.list(1, member.userId);
      expect(mockPrisma.sprintWriteExtension.findMany.mock.calls[1][0].where).toEqual({ sprintId: 1, expiresAt: { gt: expect.any(Date) }, userId: member.userId });
    });

    it('getAccess: locked sprint without extension -> canWrite false; with one -> true and its expiry', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(member);
      mockPrisma.sprintWriteExtension.findFirst.mockResolvedValue(null);
      expect(await service.getAccess(1, member.userId)).toMatchObject({ canWrite: false, windowOpen: false, extensionExpiresAt: null });

      const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
      mockPrisma.sprintWriteExtension.findFirst.mockResolvedValue({ expiresAt });
      expect(await service.getAccess(1, member.userId)).toMatchObject({ canWrite: true, windowOpen: false, extensionExpiresAt: expiresAt });
    });

    it('getAccess: anonymousAllowed is false when writing relies on an extension or the board is locked', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(member);
      // locked, no extension
      mockPrisma.sprintWriteExtension.findFirst.mockResolvedValue(null);
      expect(await service.getAccess(1, member.userId)).toMatchObject({ canWrite: false, anonymousAllowed: false });
      // locked, writable only through an extension
      mockPrisma.sprintWriteExtension.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 3600_000) });
      expect(await service.getAccess(1, member.userId)).toMatchObject({ canWrite: true, windowOpen: false, anonymousAllowed: false });
    });

    it('getAccess: inside the normal window anonymousAllowed is true (even if an extension also exists)', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(member);
      mockPrisma.sprint.findUnique.mockResolvedValue({ ...sprint, endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
      mockPrisma.sprintWriteExtension.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 3600_000) });
      expect(await service.getAccess(1, member.userId)).toMatchObject({ canWrite: true, windowOpen: true, anonymousAllowed: true });
    });
  });
});
