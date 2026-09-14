import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { AuthService } from '../auth/auth.service';

describe('GoogleCalendarController', () => {
  let controller: GoogleCalendarController;

  const authHeader = 'Bearer dummytoken';

  const mockGoogleCalendarService = {
    getAuthUrl: jest.fn(),
    getStatus: jest.fn(),
    handleCallback: jest.fn(),
    disconnect: jest.fn(),
  };

  const mockAuthService = {
    validateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleCalendarController],
      providers: [
        { provide: GoogleCalendarService, useValue: mockGoogleCalendarService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<GoogleCalendarController>(GoogleCalendarController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockResponse() {
    return { redirect: jest.fn() } as unknown as import('express').Response;
  }

  describe('connect', () => {
    it('validates the token then builds the auth URL for that user (id + email from the token, not a body)', async () => {
      mockAuthService.validateToken.mockResolvedValue({ id: 1, email: 'me@example.com' });
      mockGoogleCalendarService.getAuthUrl.mockReturnValue('https://accounts.google.com/mock');

      const result = await controller.connect(authHeader);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
      expect(mockGoogleCalendarService.getAuthUrl).toHaveBeenCalledWith(1, 'me@example.com');
      expect(result).toEqual({ authUrl: 'https://accounts.google.com/mock' });
    });
  });

  describe('status', () => {
    it("validates the token then fetches that user's own status", async () => {
      mockAuthService.validateToken.mockResolvedValue({ id: 2, email: 'other@example.com' });
      mockGoogleCalendarService.getStatus.mockResolvedValue({ connected: false });

      const result = await controller.status(authHeader);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
      expect(mockGoogleCalendarService.getStatus).toHaveBeenCalledWith(2);
      expect(result).toEqual({ connected: false });
    });
  });

  describe('disconnect — the core permission boundary (product-backlog/06 §6.3)', () => {
    // The controller method takes no body/id param at all (`disconnect(@Headers('authorization') authHeader)`)
    // — there is structurally no way for a caller to name another user's connection. The only
    // guard is that `userId` always comes from `AuthService.validateToken`'s resolved user, never
    // from anything caller-supplied. These two calls, resolving to two different users via two
    // different tokens, must each disconnect only their own id — never the other's.
    it("a member can only disconnect their own connection — userId always comes from the validated token", async () => {
      mockAuthService.validateToken.mockResolvedValueOnce({ id: 10, email: 'member-a@example.com' });
      mockGoogleCalendarService.disconnect.mockResolvedValueOnce({ id: 100, userId: 10, isRevoked: true });

      const resultA = await controller.disconnect('Bearer token-for-member-a');

      expect(mockGoogleCalendarService.disconnect).toHaveBeenCalledWith(10);
      expect(mockGoogleCalendarService.disconnect).not.toHaveBeenCalledWith(20);
      expect(resultA).toEqual({ id: 100, userId: 10, isRevoked: true });

      mockAuthService.validateToken.mockResolvedValueOnce({ id: 20, email: 'member-b@example.com' });
      mockGoogleCalendarService.disconnect.mockResolvedValueOnce({ id: 200, userId: 20, isRevoked: true });

      const resultB = await controller.disconnect('Bearer token-for-member-b');

      expect(mockGoogleCalendarService.disconnect).toHaveBeenLastCalledWith(20);
      expect(resultB).toEqual({ id: 200, userId: 20, isRevoked: true });
    });

    it('propagates NotFoundException from the service (e.g. no active connection) instead of swallowing it', async () => {
      mockAuthService.validateToken.mockResolvedValue({ id: 10, email: 'member-a@example.com' });
      mockGoogleCalendarService.disconnect.mockRejectedValue(new Error('no active connection'));

      await expect(controller.disconnect(authHeader)).rejects.toThrow('no active connection');
    });

    it('never calls disconnect if the token itself fails to validate', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Invalid token'));

      await expect(controller.disconnect('Bearer garbage')).rejects.toThrow('Invalid token');
      expect(mockGoogleCalendarService.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('callback', () => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://navet-to-retro-frontend.fly.dev';

    it('redirects with ?googleCalendar=error when Google reports an error param, without calling the service', async () => {
      const res = mockResponse();

      await controller.callback(undefined, undefined, 'access_denied', res);

      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/settings?googleCalendar=error`);
      expect(mockGoogleCalendarService.handleCallback).not.toHaveBeenCalled();
    });

    it('redirects with ?googleCalendar=error when code or state is missing', async () => {
      const res = mockResponse();

      await controller.callback(undefined, 'some-state', undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/settings?googleCalendar=error`);
      expect(mockGoogleCalendarService.handleCallback).not.toHaveBeenCalled();
    });

    it('exchanges the code and redirects with ?googleCalendar=connected on success', async () => {
      const res = mockResponse();
      mockGoogleCalendarService.handleCallback.mockResolvedValue({ id: 1 });

      await controller.callback('a-code', 'a-state', undefined, res);

      expect(mockGoogleCalendarService.handleCallback).toHaveBeenCalledWith('a-code', 'a-state');
      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/settings?googleCalendar=connected`);
    });

    it('redirects with ?googleCalendar=error (not a thrown 500) when the service call fails', async () => {
      const res = mockResponse();
      mockGoogleCalendarService.handleCallback.mockRejectedValue(new Error('token exchange failed'));

      await controller.callback('a-code', 'a-state', undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/settings?googleCalendar=error`);
    });
  });
});
