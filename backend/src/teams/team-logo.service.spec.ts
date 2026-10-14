import { ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { TeamLogoService } from './team-logo.service';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('TeamLogoService (feature 19)', () => {
  let service: TeamLogoService;
  const prisma: any = {
    team: { findUnique: jest.fn(), update: jest.fn() },
    teamMember: { findUnique: jest.fn() },
    teamLogo: { upsert: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const activeTeam = { id: 7, status: 'ACTIVE' };
  const adminMember = { status: 'ACTIVE', isAdmin: true, role: 'DEVELOPER' };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    service = new TeamLogoService(prisma);
    prisma.team.findUnique.mockResolvedValue(activeTeam);
    prisma.teamMember.findUnique.mockResolvedValue(adminMember);
    prisma.teamLogo.upsert.mockResolvedValue({});
    prisma.teamLogo.deleteMany.mockResolvedValue({ count: 1 });
    prisma.team.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ logoUpdatedAt: data.logoUpdatedAt ?? null, accentHue: data.accentHue ?? null })
    );
  });

  describe('permissions (admin only — §19.0 decision #1)', () => {
    const calls: Array<[string, () => Promise<unknown>]> = [
      ['setLogo', () => service.setLogo(7, 1, { buffer: PNG }, undefined)],
      ['removeLogo', () => service.removeLogo(7, 1)],
      ['setAccent', () => service.setAccent(7, 1, 100)],
    ];

    it.each(calls)('%s: 404 when the team does not exist', async (_n, call) => {
      prisma.team.findUnique.mockResolvedValue(null);
      await expect(call()).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(calls)('%s: 403 for a non-member', async (_n, call) => {
      prisma.teamMember.findUnique.mockResolvedValue(null);
      await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(calls)('%s: 403 for a regular member and for a non-admin TEAM_LEADER', async (_n, call) => {
      prisma.teamMember.findUnique.mockResolvedValue({ status: 'ACTIVE', isAdmin: false, role: 'DEVELOPER' });
      await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
      prisma.teamMember.findUnique.mockResolvedValue({ status: 'ACTIVE', isAdmin: false, role: 'TEAM_LEADER' });
      await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(calls)('%s: 403 for an admin whose membership is still PENDING', async (_n, call) => {
      prisma.teamMember.findUnique.mockResolvedValue({ status: 'PENDING', isAdmin: true, role: 'DEVELOPER' });
      await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(calls)('%s: 409 for a team still awaiting approval', async (_n, call) => {
      prisma.team.findUnique.mockResolvedValue({ id: 7, status: 'PENDING_APPROVAL' });
      await expect(call()).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('setLogo', () => {
    it('stores the bytes + detected type and stamps logoUpdatedAt/accentHue on the team', async () => {
      const res = await service.setLogo(7, 1, { buffer: PNG }, '172');

      const upsert = prisma.teamLogo.upsert.mock.calls[0][0];
      expect(upsert.where).toEqual({ teamId: 7 });
      expect(Buffer.from(upsert.create.data).equals(PNG)).toBe(true);
      expect(upsert.create.contentType).toBe('image/png');
      expect(upsert.update.contentType).toBe('image/png');
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { logoUpdatedAt: expect.any(Date), accentHue: 172 },
      });
      expect(res.accentHue).toBe(172);
      expect(res.logoUpdatedAt).toBeInstanceOf(Date);
    });

    it('a missing accentHue means "no team colour" (null), not "leave unchanged"', async () => {
      await service.setLogo(7, 1, { buffer: PNG }, undefined);
      expect(prisma.team.update.mock.calls[0][0].data.accentHue).toBeNull();
    });

    it('rejects a non-image / missing file / bad hue with 400 and writes nothing', async () => {
      await expect(service.setLogo(7, 1, { buffer: Buffer.from('<svg/>') }, undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setLogo(7, 1, undefined, undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setLogo(7, 1, { buffer: PNG }, '999')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.teamLogo.upsert).not.toHaveBeenCalled();
      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });

  describe('removeLogo', () => {
    it('deletes the logo and clears logoUpdatedAt + accentHue (the colour came from the logo)', async () => {
      const res = await service.removeLogo(7, 1);
      expect(prisma.teamLogo.deleteMany).toHaveBeenCalledWith({ where: { teamId: 7 } });
      expect(prisma.team.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { logoUpdatedAt: null, accentHue: null } });
      expect(res).toEqual({ logoUpdatedAt: null, accentHue: null });
    });

    it('is idempotent: removing when there is no logo does not throw', async () => {
      prisma.teamLogo.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.removeLogo(7, 1)).resolves.toBeDefined();
    });
  });

  describe('setAccent', () => {
    it('updates only the hue; null clears it', async () => {
      await service.setAccent(7, 1, 200);
      expect(prisma.team.update).toHaveBeenLastCalledWith({ where: { id: 7 }, data: { accentHue: 200 } });
      await service.setAccent(7, 1, null);
      expect(prisma.team.update).toHaveBeenLastCalledWith({ where: { id: 7 }, data: { accentHue: null } });
    });

    it('rejects an out-of-range hue', async () => {
      await expect(service.setAccent(7, 1, 360)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getLogo (ACTIVE and PENDING members — §19.0 decision #9)', () => {
    it('serves the logo to an ACTIVE and to a PENDING member', async () => {
      prisma.teamLogo.findUnique.mockResolvedValue({ data: new Uint8Array(PNG), contentType: 'image/png' });
      for (const status of ['ACTIVE', 'PENDING']) {
        prisma.teamMember.findUnique.mockResolvedValue({ status, isAdmin: false, role: 'DEVELOPER' });
        const res = await service.getLogo(7, 2);
        expect(res.contentType).toBe('image/png');
        expect(res.data.equals(PNG)).toBe(true);
      }
    });

    it('403 for a non-member, 404 when the team or the logo is missing', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.getLogo(7, 2)).rejects.toBeInstanceOf(ForbiddenException);

      prisma.teamMember.findUnique.mockResolvedValue(adminMember);
      prisma.teamLogo.findUnique.mockResolvedValue(null);
      await expect(service.getLogo(7, 2)).rejects.toBeInstanceOf(NotFoundException);

      prisma.team.findUnique.mockResolvedValue(null);
      await expect(service.getLogo(7, 2)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
  describe('a soft-deleted team (feature 14, §19.0 decision #13)', () => {
    const deletedTeam = { id: 7, status: 'ACTIVE', deletedAt: new Date() };

    it('every operation is 404 — the logo bytes outlive a soft delete, so they must not be served', async () => {
      prisma.team.findUnique.mockResolvedValue(deletedTeam);
      prisma.teamLogo.findUnique.mockResolvedValue({ data: new Uint8Array(PNG), contentType: 'image/png' });

      await expect(service.setLogo(7, 1, { buffer: PNG }, undefined)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.removeLogo(7, 1)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.setAccent(7, 1, 100)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getLogo(7, 1)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.teamLogo.upsert).not.toHaveBeenCalled();
      expect(prisma.teamLogo.findUnique).not.toHaveBeenCalled();
    });
  });
});
