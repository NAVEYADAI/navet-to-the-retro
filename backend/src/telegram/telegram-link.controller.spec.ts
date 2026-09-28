import { Test, TestingModule } from '@nestjs/testing';
import { TelegramLinkController } from './telegram-link.controller';
import { TelegramLinkService } from './telegram-link.service';
import { AuthService } from '../auth/auth.service';

describe('TelegramLinkController', () => {
  let controller: TelegramLinkController;
  const authHeader = 'Bearer dummytoken';

  const mockTelegramLinkService = { link: jest.fn(), unlink: jest.fn(), getStatus: jest.fn() };
  const mockAuthService = { validateToken: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramLinkController],
      providers: [
        { provide: TelegramLinkService, useValue: mockTelegramLinkService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get(TelegramLinkController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('link', () => {
    it('validates the token then links using the resolved user id, not anything caller-supplied', async () => {
      mockAuthService.validateToken.mockResolvedValue({ id: 1 });
      const dto = { id: 555, first_name: 'A', auth_date: 1, hash: 'h' } as any;
      mockTelegramLinkService.link.mockResolvedValue({ id: 10 });

      const result = await controller.link(authHeader, dto);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
      expect(mockTelegramLinkService.link).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual({ id: 10 });
    });

    it('never calls the service if the token fails to validate', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Invalid token'));

      await expect(controller.link(authHeader, {} as any)).rejects.toThrow('Invalid token');
      expect(mockTelegramLinkService.link).not.toHaveBeenCalled();
    });
  });

  describe('unlink', () => {
    it("only ever unlinks the requester's own link — userId always comes from the validated token", async () => {
      mockAuthService.validateToken.mockResolvedValue({ id: 2 });
      mockTelegramLinkService.unlink.mockResolvedValue({ id: 20, userId: 2, isRevoked: true });

      const result = await controller.unlink(authHeader);

      expect(mockTelegramLinkService.unlink).toHaveBeenCalledWith(2);
      expect(result).toEqual({ id: 20, userId: 2, isRevoked: true });
    });
  });

  describe('status', () => {
    it("validates the token then fetches that user's own status", async () => {
      mockAuthService.validateToken.mockResolvedValue({ id: 3 });
      mockTelegramLinkService.getStatus.mockResolvedValue({ connected: true });

      const result = await controller.status(authHeader);

      expect(mockTelegramLinkService.getStatus).toHaveBeenCalledWith(3);
      expect(result).toEqual({ connected: true });
    });
  });
});
