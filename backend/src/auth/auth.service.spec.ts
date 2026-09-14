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
        orderBy: { id: 'asc' },
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

    it('should throw a clear error (not crash bcrypt.compare) for a Google-only user with password:null', async () => {
      // Feature 7 (product-backlog/07-google-sign-in.md §7.0 default #4): a Google-only user has password:null
      // permanently. Regression pin: this must not reach bcrypt.compare(dto.password, null),
      // which bcryptjs throws on internally.
      mockPrismaService.user.findFirst.mockResolvedValue({ ...mockUser, password: null });

      const dto = {
        username: 'googleuser',
        password: 'whatever',
      };

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should still allow password login for a user that has both a password and a linked googleId', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ ...mockUser, googleId: 'g1' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const dto = {
        username: 'testuser',
        password: 'password123',
      };

      const result = await service.login(dto);
      expect(result.accessToken).toBeDefined();
    });
  });

  describe('validateToken', () => {
    const secret = process.env.JWT_SECRET || 'retro-secret-key-12345';

    it('should throw UnauthorizedException when the auth header is missing', async () => {
      await expect(service.validateToken('')).rejects.toThrow(
        new UnauthorizedException('Missing authorization header')
      );
    });

    it('should reject a validly-signed token carrying a `purpose` claim (2026-09-14 security fix)', async () => {
      // Pins the fix: a leaked short-lived narrow-purpose token (Google-calendar-connect
      // `state`, Google-login `state`/`ticket`) — all signed with this same JWT_SECRET, all
      // shaped as `{sub, ...}` — must never be usable as a Bearer session token here. Real
      // session tokens (register/login/Google issueSession) never set `purpose`.
      const tokenWithPurpose = jwt.sign({ sub: mockUser.id, purpose: 'google-login-ticket' }, secret, { expiresIn: '12h' });

      await expect(service.validateToken(`Bearer ${tokenWithPurpose}`)).rejects.toThrow(
        new UnauthorizedException('Invalid token')
      );
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
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
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      const updated = { ...mockUser, firstName: 'Updated' };
      mockPrismaService.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile(mockUser.id, { firstName: 'Updated' });

      // No email in the dto at all -> emailChanged is false -> email/emailVerifiedAt untouched.
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { firstName: 'Updated', lastName: undefined, email: undefined },
      });
      expect(mockPrismaService.user.findFirst).not.toHaveBeenCalled();
      expect(result.firstName).toBe('Updated');
      expect((result as any).password).toBeUndefined();
    });

    it('should not treat a same-address save (different case/whitespace) as a real email change', async () => {
      // §7.4: the frontend always resends the current email on every save, even a
      // firstName-only edit — this must not reset emailVerifiedAt or run the collision check.
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.updateProfile(mockUser.id, {
        firstName: 'Test',
        email: `  ${mockUser.email.toUpperCase()}  `,
      });

      expect(mockPrismaService.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { firstName: 'Test', lastName: undefined, email: undefined },
      });
    });

    it('should reset emailVerifiedAt when the email genuinely changes to an unclaimed address', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst.mockResolvedValue(null); // no collision
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, email: 'new@example.com' });

      await service.updateProfile(mockUser.id, { email: 'new@example.com' });

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'new@example.com', mode: 'insensitive' }, NOT: { id: mockUser.id } },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { firstName: undefined, lastName: undefined, email: 'new@example.com', emailVerifiedAt: null },
      });
    });

    it('should reject changing to an email already claimed by a different user, without writing anything', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst.mockResolvedValue({ ...mockUser, id: 2, email: 'taken@example.com' });

      await expect(
        service.updateProfile(mockUser.id, { email: 'taken@example.com' })
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });
});
