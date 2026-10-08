import * as crypto from 'crypto';
import { ConflictException, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TelegramLinkService } from './telegram-link.service';
import { PrismaService } from '../prisma.service';

// Builds a real, validly-signed Telegram Login Widget payload per Telegram's spec — see
// telegram-auth.util.ts — so the "valid hash" tests exercise the real verification code, not a
// mocked-away shortcut.
function signPayload(fields: Record<string, string | number>, botToken: string) {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return { ...fields, hash };
}

describe('TelegramLinkService', () => {
  const originalEnv = process.env;
  const botToken = 'test-bot-token';

  let service: TelegramLinkService;
  const mockPrisma = {
    userMessagingLink: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    // Array-form $transaction: operations are already-created promises, so just await them all.
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    process.env = { ...originalEnv, TELEGRAM_BOT_TOKEN: botToken };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TelegramLinkService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(TelegramLinkService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  describe('link', () => {
    const basePayload = { id: 123456, first_name: 'Nave', auth_date: Math.floor(Date.now() / 1000) };

    it('throws InternalServerErrorException when TELEGRAM_BOT_TOKEN is not configured', async () => {
      process.env = { ...originalEnv, TELEGRAM_BOT_TOKEN: undefined };
      const module: TestingModule = await Test.createTestingModule({
        providers: [TelegramLinkService, { provide: PrismaService, useValue: mockPrisma }],
      }).compile();
      const unconfiguredService = module.get<TelegramLinkService>(TelegramLinkService);

      await expect(unconfiguredService.link(1, signPayload(basePayload, botToken) as any)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('accepts a correctly-signed payload and creates a new link', async () => {
      const dto = signPayload(basePayload, botToken);
      mockPrisma.userMessagingLink.findUnique.mockResolvedValue(null);
      mockPrisma.userMessagingLink.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.userMessagingLink.upsert.mockResolvedValue({ id: 1, userId: 7, externalId: '123456' });

      const result = await service.link(7, dto as any);

      expect(mockPrisma.userMessagingLink.upsert).toHaveBeenCalledWith({
        where: { channel_externalId: { channel: 'TELEGRAM', externalId: '123456' } },
        update: { userId: 7, isRevoked: false },
        create: { channel: 'TELEGRAM', externalId: '123456', userId: 7, isRevoked: false },
      });
      expect(result).toEqual({ id: 1, userId: 7, externalId: '123456' });
    });

    it('rejects a payload with a tampered/forged hash', async () => {
      const dto = { ...signPayload(basePayload, botToken), first_name: 'Someone Else' }; // mutated after signing

      await expect(service.link(7, dto as any)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.userMessagingLink.upsert).not.toHaveBeenCalled();
    });

    it('rejects a payload with a hash signed by the wrong bot token', async () => {
      const dto = signPayload(basePayload, 'a-different-bot-token');

      await expect(service.link(7, dto as any)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a payload whose auth_date is too old (> 1 day)', async () => {
      const staleAuthDate = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
      const dto = signPayload({ ...basePayload, auth_date: staleAuthDate }, botToken);

      await expect(service.link(7, dto as any)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.userMessagingLink.upsert).not.toHaveBeenCalled();
    });

    it('rejects a payload whose auth_date is only 10 minutes old (BUG-50: window is 5 minutes)', async () => {
      const authDate = Math.floor(Date.now() / 1000) - 10 * 60;
      const dto = signPayload({ ...basePayload, auth_date: authDate }, botToken);

      await expect(service.link(7, dto as any)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.userMessagingLink.upsert).not.toHaveBeenCalled();
    });

    it('revokes the user\'s other active links when linking a different Telegram account (BUG-49)', async () => {
      const dto = signPayload(basePayload, botToken);
      mockPrisma.userMessagingLink.findUnique.mockResolvedValue(null);
      mockPrisma.userMessagingLink.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.userMessagingLink.upsert.mockResolvedValue({ id: 2, userId: 7, externalId: '123456' });

      await service.link(7, dto as any);

      expect(mockPrisma.userMessagingLink.updateMany).toHaveBeenCalledWith({
        where: { channel: 'TELEGRAM', userId: 7, isRevoked: false, externalId: { not: '123456' } },
        data: { isRevoked: true },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects linking a Telegram account already actively linked to a different user', async () => {
      const dto = signPayload(basePayload, botToken);
      mockPrisma.userMessagingLink.findUnique.mockResolvedValue({ id: 1, userId: 999, externalId: '123456', isRevoked: false });

      await expect(service.link(7, dto as any)).rejects.toThrow(ConflictException);
      expect(mockPrisma.userMessagingLink.upsert).not.toHaveBeenCalled();
    });

    it('allows re-linking the same account to the same user (idempotent)', async () => {
      const dto = signPayload(basePayload, botToken);
      mockPrisma.userMessagingLink.findUnique.mockResolvedValue({ id: 1, userId: 7, externalId: '123456', isRevoked: false });
      mockPrisma.userMessagingLink.upsert.mockResolvedValue({ id: 1, userId: 7, externalId: '123456' });

      await expect(service.link(7, dto as any)).resolves.toBeDefined();
    });

    it('allows linking an account whose previous link (to a different user) was revoked', async () => {
      const dto = signPayload(basePayload, botToken);
      mockPrisma.userMessagingLink.findUnique.mockResolvedValue({ id: 1, userId: 999, externalId: '123456', isRevoked: true });
      mockPrisma.userMessagingLink.upsert.mockResolvedValue({ id: 1, userId: 7, externalId: '123456' });

      await expect(service.link(7, dto as any)).resolves.toBeDefined();
      expect(mockPrisma.userMessagingLink.upsert).toHaveBeenCalled();
    });
  });

  describe('unlink', () => {
    it('throws NotFoundException when there is no active link', async () => {
      mockPrisma.userMessagingLink.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.unlink(7)).rejects.toThrow(NotFoundException);
    });

    it('soft-revokes (isRevoked=true) ALL of the user\'s active links instead of deleting rows (BUG-49)', async () => {
      mockPrisma.userMessagingLink.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.unlink(7);

      expect(mockPrisma.userMessagingLink.updateMany).toHaveBeenCalledWith({
        where: { channel: 'TELEGRAM', userId: 7, isRevoked: false },
        data: { isRevoked: true },
      });
      expect(result).toEqual({ connected: false, revokedCount: 2 });
    });
  });

  describe('getStatus', () => {
    it('returns connected:false when there is no active link', async () => {
      mockPrisma.userMessagingLink.findFirst.mockResolvedValue(null);
      await expect(service.getStatus(7)).resolves.toEqual({ connected: false });
    });

    it('returns connected:true when there is an active link', async () => {
      mockPrisma.userMessagingLink.findFirst.mockResolvedValue({ id: 1, userId: 7, isRevoked: false });
      await expect(service.getStatus(7)).resolves.toEqual({ connected: true });
    });
  });
});
