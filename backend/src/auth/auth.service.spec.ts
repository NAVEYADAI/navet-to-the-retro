import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

// Mock bcryptjs at the top
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    role: 'DEVELOPER',
    createdAt: new Date(),
  };

  const mockTx = {
    user: {
      create: jest.fn(),
    },
    team: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockTx)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const dto = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = await service.register(dto);
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.user.username).toBe(dto.username);
      expect((result.user as any).password).toBeUndefined(); // Excludes password
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const dto = {
        username: 'testuser',
        email: 'brandnew@example.com',
        password: 'password123',
      };

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const dto = {
        username: 'brandnewuser',
        email: 'test@example.com',
        password: 'password123',
      };

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should default username to email when username is omitted', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const dto = {
        email: 'test@example.com',
        password: 'password123',
      };

      await service.register(dto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ username: 'test@example.com' }),
        })
      );
    });

    it('should default role to DEVELOPER when omitted', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const dto = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      await service.register(dto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'DEVELOPER' }),
        })
      );
    });

    it('should pass through an explicit role unchanged', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ ...mockUser, role: 'TEAM_LEADER' });

      const dto = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'TEAM_LEADER',
      };

      await service.register(dto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'TEAM_LEADER' }),
        })
      );
    });
  });

  describe('login', () => {
    it('should login successfully and return access token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      // Use mock resolved value on the mocked function
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const dto = {
        username: 'testuser',
        password: 'password123',
      };

      const result = await service.login(dto);
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.user.username).toBe(mockUser.username);
    });

    it('should allow logging in with an email in the username field', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const dto = {
        username: 'test@example.com',
        password: 'password123',
      };

      await service.login(dto);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ username: dto.username }, { email: dto.username }],
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const dto = {
        username: 'nonexistent',
        password: 'password123',
      };

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      // Mock invalid password match
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const dto = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateToken', () => {
    const secret = process.env.JWT_SECRET || 'retro-secret-key-12345';

    it('should throw UnauthorizedException when the auth header is missing', async () => {
      await expect(service.validateToken('')).rejects.toThrow(
        new UnauthorizedException('Missing authorization header')
      );
    });

    it('should throw a generic "Invalid token" for a malformed token', async () => {
      // Regression pin for a known bug (see specs/00-shared-conventions.md): validateToken's
      // catch block swallows the real failure reason and always rethrows 'Invalid token'.
      await expect(service.validateToken('Bearer not-a-real-jwt')).rejects.toThrow(
        new UnauthorizedException('Invalid token')
      );
    });

    it('should throw "Invalid token" for an expired token', async () => {
      const expiredToken = jwt.sign({ sub: mockUser.id }, secret, { expiresIn: -10 });

      await expect(service.validateToken(`Bearer ${expiredToken}`)).rejects.toThrow(
        new UnauthorizedException('Invalid token')
      );
    });

    it('should throw the generic "Invalid token" (not "User not found") when the user no longer exists', async () => {
      const validToken = jwt.sign({ sub: 999 }, secret, { expiresIn: '12h' });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // The service throws 'User not found' internally, but its own try/catch swallows that
      // and rethrows the generic message below — this pins the actual observable behavior.
      await expect(service.validateToken(`Bearer ${validToken}`)).rejects.toThrow(
        new UnauthorizedException('Invalid token')
      );
    });

    it('should return the user without the password on a valid token', async () => {
      const validToken = jwt.sign({ sub: mockUser.id }, secret, { expiresIn: '12h' });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateToken(`Bearer ${validToken}`);

      expect(result.id).toBe(mockUser.id);
      expect((result as any).password).toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    it('should update the user and strip the password from the result', async () => {
      const updated = { ...mockUser, firstName: 'Updated' };
      mockPrismaService.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile(mockUser.id, { firstName: 'Updated' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { firstName: 'Updated', lastName: undefined, email: undefined },
      });
      expect(result.firstName).toBe('Updated');
      expect((result as any).password).toBeUndefined();
    });
  });
});
