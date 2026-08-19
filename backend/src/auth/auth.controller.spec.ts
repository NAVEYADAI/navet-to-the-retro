import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
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
});
