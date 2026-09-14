import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleLoginService } from './google-login.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    createdAt: new Date(),
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    validateToken: jest.fn(),
    updateProfile: jest.fn(),
  };

  const mockGoogleLoginService = {
    getAuthUrl: jest.fn(),
    handleCallback: jest.fn(),
    exchangeTicket: jest.fn(),
    completeGoogleRegistration: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: GoogleLoginService,
          useValue: mockGoogleLoginService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a user', async () => {
      mockAuthService.register.mockResolvedValue(mockUser);

      const dto = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = await controller.register(dto);
      expect(result).toBe(mockUser);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should login and return access token', async () => {
      const loginResponse = {
        accessToken: 'dummytoken',
        user: mockUser,
      };
      mockAuthService.login.mockResolvedValue(loginResponse);

      const dto = {
        username: 'testuser',
        password: 'password123',
      };

      const result = await controller.login(dto);
      expect(result).toBe(loginResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('me', () => {
    it('should return user details for valid token', async () => {
      mockAuthService.validateToken.mockResolvedValue(mockUser);

      const authHeader = 'Bearer dummytoken';
      const result = await controller.me(authHeader);
      expect(result).toBe(mockUser);
      expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
    });
  });

  describe('updateProfile', () => {
    it('should validate the token then update the profile for that user', async () => {
      mockAuthService.validateToken.mockResolvedValue(mockUser);
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockAuthService.updateProfile.mockResolvedValue(updatedUser);

      const authHeader = 'Bearer dummytoken';
      const dto = { firstName: 'Updated' };

      const result = await controller.updateProfile(authHeader, dto);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(authHeader);
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toBe(updatedUser);
    });
  });

  describe('googleConnect', () => {
    it('returns the authUrl from GoogleLoginService without requiring a token', async () => {
      mockGoogleLoginService.getAuthUrl.mockReturnValue('https://accounts.google.com/mock');

      const result = await controller.googleConnect();

      expect(result).toEqual({ authUrl: 'https://accounts.google.com/mock' });
      expect(mockAuthService.validateToken).not.toHaveBeenCalled();
    });
  });

  describe('googleCallback', () => {
    function mockRes() {
      return { redirect: jest.fn() } as any;
    }

    it('redirects with ?error=1 when Google reports an error or code/state are missing', async () => {
      const res = mockRes();

      await controller.googleCallback(undefined, undefined, 'access_denied', res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/auth/google/callback?error=1'));
      expect(mockGoogleLoginService.handleCallback).not.toHaveBeenCalled();
    });

    it('redirects with ?ticket=<ticket> when an existing user was resolved', async () => {
      mockGoogleLoginService.handleCallback.mockResolvedValue({ ticket: 'signed-ticket' });
      const res = mockRes();

      await controller.googleCallback('code', 'state', undefined, res);

      expect(mockGoogleLoginService.handleCallback).toHaveBeenCalledWith('code', 'state');
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/auth/google/callback?ticket=signed-ticket'));
    });

    it('redirects with ?pendingTicket=<ticket> when no existing user matched (needs role selection)', async () => {
      mockGoogleLoginService.handleCallback.mockResolvedValue({ pendingTicket: 'pending-abc' });
      const res = mockRes();

      await controller.googleCallback('code', 'state', undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/auth/google/callback?pendingTicket=pending-abc'));
    });

    it('redirects with ?error=1 when handleCallback throws', async () => {
      mockGoogleLoginService.handleCallback.mockRejectedValue(new Error('boom'));
      const res = mockRes();

      await controller.googleCallback('code', 'state', undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/auth/google/callback?error=1'));
    });
  });

  describe('googleExchange', () => {
    it('returns {accessToken, user} from GoogleLoginService.exchangeTicket', async () => {
      const exchangeResponse = { accessToken: 'dummytoken', user: mockUser };
      mockGoogleLoginService.exchangeTicket.mockResolvedValue(exchangeResponse);

      const result = await controller.googleExchange({ ticket: 'signed-ticket' });

      expect(mockGoogleLoginService.exchangeTicket).toHaveBeenCalledWith('signed-ticket');
      expect(result).toBe(exchangeResponse);
    });
  });

  describe('completeGoogleRegistration', () => {
    it('returns {accessToken, user} from GoogleLoginService.completeGoogleRegistration', async () => {
      const response = { accessToken: 'dummytoken', user: mockUser };
      mockGoogleLoginService.completeGoogleRegistration.mockResolvedValue(response);

      const result = await controller.completeGoogleRegistration({ pendingTicket: 'pending-abc', role: 'TEAM_LEADER' });

      expect(mockGoogleLoginService.completeGoogleRegistration).toHaveBeenCalledWith('pending-abc', 'TEAM_LEADER');
      expect(result).toBe(response);
    });
  });
});
