import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { GoogleLoginService } from './google-login.service';

// `googleapis` is fully mocked — no real network call ever leaves this process. Mirrors the
// pattern already established in google-calendar.service.spec.ts.
const mockGenerateAuthUrl = jest.fn();
const mockGetToken = jest.fn();
const mockSetCredentials = jest.fn();
const mockUserinfoGet = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        setCredentials: mockSetCredentials,
      })),
    },
    oauth2: jest.fn().mockImplementation(() => ({
      userinfo: { get: mockUserinfoGet },
    })),
  },
}));

describe('GoogleLoginService', () => {
  const originalEnv = process.env;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const configuredEnv = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_LOGIN_REDIRECT_URI: 'http://localhost:5005/auth/google/callback',
    JWT_SECRET: 'test-jwt-secret',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadService(env: Record<string, string> = {}) {
    process.env = { ...originalEnv, ...env };
    return new GoogleLoginService(mockPrisma as any);
  }

  describe('getAuthUrl', () => {
    it('throws when GOOGLE_CLIENT_ID/SECRET/GOOGLE_LOGIN_REDIRECT_URI are not fully configured', () => {
      const service = loadService({
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_LOGIN_REDIRECT_URI: '',
      });

      expect(() => service.getAuthUrl()).toThrow(InternalServerErrorException);
    });

    it('generates the auth URL with the narrow login scope and no offline/consent flags', () => {
      mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
      const service = loadService(configuredEnv);

      const url = service.getAuthUrl();

      expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
      const [[callArgs]] = mockGenerateAuthUrl.mock.calls;
      expect(callArgs.scope).toEqual(['openid', 'email', 'profile']);
      expect(callArgs.access_type).toBeUndefined();
      expect(callArgs.prompt).toBeUndefined();
      // `state` must at least be a validly-signed JWT under the same secret (anti-CSRF nonce).
      expect(() => jwt.verify(callArgs.state, configuredEnv.JWT_SECRET)).not.toThrow();
    });
  });

  describe('handleCallback', () => {
    function validState() {
      return jwt.sign({ purpose: 'google-login' }, configuredEnv.JWT_SECRET, { expiresIn: '10m' });
    }

    it('throws when not configured', async () => {
      const service = loadService({
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_LOGIN_REDIRECT_URI: '',
      });

      await expect(service.handleCallback('code', 'state')).rejects.toThrow(InternalServerErrorException);
    });

    it('throws UnauthorizedException when `state` is invalid or expired', async () => {
      const service = loadService(configuredEnv);

      await expect(service.handleCallback('code', 'not-a-real-jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when `state` is validly signed but carries the wrong purpose (2026-09-14 security fix)', async () => {
      // Pins the fix: a `state` minted by a *different* flow (e.g. GoogleCalendarService's
      // connect state) sharing the same JWT_SECRET must not be accepted here.
      const service = loadService(configuredEnv);
      const wrongPurposeState = jwt.sign({ sub: 1, purpose: 'google-calendar-connect' }, configuredEnv.JWT_SECRET, { expiresIn: '10m' });

      await expect(service.handleCallback('code', wrongPurposeState)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when Google does not return an access token', async () => {
      const service = loadService(configuredEnv);
      mockGetToken.mockResolvedValue({ tokens: {} });

      await expect(service.handleCallback('code', validState())).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when userinfo has no email/id', async () => {
      const service = loadService(configuredEnv);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a' } });
      mockUserinfoGet.mockResolvedValue({ data: {} });

      await expect(service.handleCallback('code', validState())).rejects.toThrow(UnauthorizedException);
    });

    it('returns a pendingTicket (not a real ticket, and does NOT create a User) when nothing matches', async () => {
      // 2026-09-13: a brand-new Google identity no longer gets an account created straight from
      // handleCallback — it needs a role picked first (see `completeGoogleRegistration` below).
      const service = loadService(configuredEnv);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a' } });
      mockUserinfoGet.mockResolvedValue({
        data: { id: 'google-sub-1', email: 'newuser@example.com', given_name: 'New', family_name: 'User' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null); // no existing googleId match
      mockPrisma.user.findFirst.mockResolvedValue(null); // no existing email match

      const result = await service.handleCallback('code', validState());

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect('pendingTicket' in result).toBe(true);
      const payload = jwt.verify((result as any).pendingTicket, configuredEnv.JWT_SECRET) as jwt.JwtPayload & {
        pendingGoogleSignup: boolean; googleId: string; email: string; firstName?: string; lastName?: string;
      };
      expect(payload.pendingGoogleSignup).toBe(true);
      expect(payload.googleId).toBe('google-sub-1');
      expect(payload.email).toBe('newuser@example.com');
      expect(payload.firstName).toBe('New');
      expect(payload.lastName).toBe('User');
    });

    it('finds an existing user by googleId on a returning Google user instead of creating a new one', async () => {
      const service = loadService(configuredEnv);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a' } });
      mockUserinfoGet.mockResolvedValue({ data: { id: 'google-sub-3', email: 'returning@example.com' } });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 7, googleId: 'google-sub-3', email: 'returning@example.com' });

      const result = await service.handleCallback('code', validState());

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect('ticket' in result).toBe(true);
      const payload = jwt.verify((result as any).ticket, configuredEnv.JWT_SECRET) as jwt.JwtPayload;
      expect(payload.sub).toBe(7);
    });

    it('auto-links by case-insensitive email match to an existing password-registered user (no new User created)', async () => {
      const service = loadService(configuredEnv);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a' } });
      mockUserinfoGet.mockResolvedValue({ data: { id: 'google-sub-4', email: 'Existing@Example.com' } });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // no googleId match
      const existingUser = { id: 5, googleId: null, email: 'existing@example.com', password: 'hashed' };
      mockPrisma.user.findFirst.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({ ...existingUser, googleId: 'google-sub-4' });

      const result = await service.handleCallback('code', validState());

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'Existing@Example.com', mode: 'insensitive' } },
        orderBy: { id: 'asc' },
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 5 },
        // BUG-05: the row had no `emailVerifiedAt`, so its (unproven) password is dropped on link.
        data: { googleId: 'google-sub-4', emailVerifiedAt: expect.any(Date), password: null },
      });
      const payload = jwt.verify((result as any).ticket, configuredEnv.JWT_SECRET) as jwt.JwtPayload;
      expect(payload.sub).toBe(5);
    });

    it('keeps the password when linking a row whose email was already verified', async () => {
      const service = loadService(configuredEnv);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a' } });
      mockUserinfoGet.mockResolvedValue({ data: { id: 'google-sub-4', email: 'existing@example.com' } });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const existingUser = { id: 5, googleId: null, email: 'existing@example.com', password: 'hashed', emailVerifiedAt: new Date() };
      mockPrisma.user.findFirst.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({ ...existingUser, googleId: 'google-sub-4' });

      await service.handleCallback('code', validState());

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { googleId: 'google-sub-4', emailVerifiedAt: expect.any(Date) },
      });
    });

    it('does not crash on an email collision with a User already linked to a different googleId (known unresolved edge case)', async () => {
      const service = loadService(configuredEnv);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a' } });
      mockUserinfoGet.mockResolvedValue({ data: { id: 'google-sub-new', email: 'shared@example.com' } });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // no match for this googleId
      const collidingUser = { id: 11, googleId: 'some-other-google-sub', email: 'shared@example.com' };
      mockPrisma.user.findFirst.mockResolvedValue(collidingUser);

      const result = await service.handleCallback('code', validState());

      // Doesn't overwrite the other party's googleId and doesn't create a duplicate row either —
      // it just proceeds without crashing/blocking, per the deferred product decision. Since
      // `update`/`create` are never called at all on this path, `emailVerifiedAt` is (correctly)
      // never written here either — §7.4 deliberately does not touch this branch. The colliding
      // row still counts as "a match," so this returns a real ticket, not a pendingTicket.
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect('ticket' in result).toBe(true);
      const payload = jwt.verify((result as any).ticket, configuredEnv.JWT_SECRET) as jwt.JwtPayload;
      expect(payload.sub).toBe(11);
    });
  });

  describe('completeGoogleRegistration', () => {
    function pendingTicketFor(profile: { googleId: string; email: string; firstName?: string; lastName?: string }) {
      return jwt.sign({ pendingGoogleSignup: true, ...profile }, configuredEnv.JWT_SECRET, { expiresIn: '10m', jwtid: `pending-${Math.random()}` });
    }

    it('throws UnauthorizedException for an invalid/expired pending ticket', async () => {
      const service = loadService(configuredEnv);

      await expect(service.completeGoogleRegistration('not-a-real-jwt', 'DEVELOPER')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a well-formed JWT that is not actually a pending-signup ticket (e.g. a real login ticket)', async () => {
      const service = loadService(configuredEnv);
      const realTicket = jwt.sign({ sub: 1 }, configuredEnv.JWT_SECRET, { expiresIn: '2m' });

      await expect(service.completeGoogleRegistration(realTicket, 'DEVELOPER')).rejects.toThrow(UnauthorizedException);
    });

    it('BUG-21: a pending ticket can complete registration only once (replay is rejected)', async () => {
      const service = loadService(configuredEnv);
      const ticket = pendingTicketFor({ googleId: 'google-sub-r', email: 'replay@example.com' });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 98, username: 'replay', email: 'replay@example.com', password: null });

      await expect(service.completeGoogleRegistration(ticket, 'DEVELOPER')).resolves.toBeDefined();
      await expect(service.completeGoogleRegistration(ticket, 'DEVELOPER')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('creates a fresh User with password:null, the chosen role, and a username derived from the email local-part', async () => {
      const service = loadService(configuredEnv);
      const ticket = pendingTicketFor({ googleId: 'google-sub-2', email: 'brandnew@example.com', firstName: 'Brand', lastName: 'New' });
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // findExistingUser's googleId lookup
        .mockResolvedValueOnce(null); // username-uniqueness loop, first candidate free
      mockPrisma.user.findFirst.mockResolvedValue(null); // findExistingUser's email lookup
      mockPrisma.user.create.mockResolvedValue({ id: 99, username: 'brandnew', email: 'brandnew@example.com', password: null });

      await service.completeGoogleRegistration(ticket, 'TEAM_LEADER');

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'brandnew',
          email: 'brandnew@example.com',
          password: null,
          googleId: 'google-sub-2',
          emailVerifiedAt: expect.any(Date),
          firstName: 'Brand',
          lastName: 'New',
          role: 'TEAM_LEADER',
        }),
      });
    });

    it('defaults to DEVELOPER when no role is provided', async () => {
      const service = loadService(configuredEnv);
      const ticket = pendingTicketFor({ googleId: 'google-sub-5', email: 'norole@example.com' });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 100, username: 'norole', email: 'norole@example.com', password: null });

      await service.completeGoogleRegistration(ticket, undefined);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: 'DEVELOPER' }),
      });
    });

    it('logs the user in as-is (ignoring the chosen role) instead of creating a duplicate, if a match now exists (race with a second signup)', async () => {
      const service = loadService(configuredEnv);
      const ticket = pendingTicketFor({ googleId: 'google-sub-6', email: 'racey@example.com' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 200, googleId: 'google-sub-6', email: 'racey@example.com', username: 'racey', password: null });

      const result = await service.completeGoogleRegistration(ticket, 'TESTER');

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(result.accessToken).toBeDefined();
      expect(result.user).toEqual(expect.objectContaining({ id: 200 }));
    });
  });

  describe('exchangeTicket', () => {
    it('throws UnauthorizedException for an invalid/expired ticket', async () => {
      const service = loadService(configuredEnv);

      await expect(service.exchangeTicket('not-a-real-jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when a validly-signed token is missing/has the wrong `purpose` (2026-09-14 security fix)', async () => {
      // Pins the fix: previously any `{sub}`-shaped JWT signed with the shared secret — e.g. a
      // leaked GoogleCalendarService connect `state` — could be exchanged here for a session.
      const service = loadService(configuredEnv);
      const noPurposeTicket = jwt.sign({ sub: 1 }, configuredEnv.JWT_SECRET, { expiresIn: '2m' });
      const wrongPurposeTicket = jwt.sign({ sub: 1, purpose: 'google-calendar-connect' }, configuredEnv.JWT_SECRET, { expiresIn: '2m' });

      await expect(service.exchangeTicket(noPurposeTicket)).rejects.toThrow(UnauthorizedException);
      await expect(service.exchangeTicket(wrongPurposeTicket)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the ticket is valid but the user no longer exists', async () => {
      const service = loadService(configuredEnv);
      const ticket = jwt.sign({ sub: 123, purpose: 'google-login-ticket' }, configuredEnv.JWT_SECRET, { expiresIn: '2m', jwtid: 'jti-123' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.exchangeTicket(ticket)).rejects.toThrow(UnauthorizedException);
    });

    it('BUG-21: a ticket can be exchanged only once (replay is rejected)', async () => {
      const service = loadService(configuredEnv);
      const ticket = jwt.sign({ sub: 55, purpose: 'google-login-ticket' }, configuredEnv.JWT_SECRET, { expiresIn: '2m', jwtid: 'replay-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 55, username: 'someone', email: 's@example.com', password: null });

      await expect(service.exchangeTicket(ticket)).resolves.toBeDefined();
      await expect(service.exchangeTicket(ticket)).rejects.toThrow(UnauthorizedException);
    });

    it('BUG-21: a ticket without a jti (not minted by handleCallback) is rejected', async () => {
      const service = loadService(configuredEnv);
      const ticket = jwt.sign({ sub: 55, purpose: 'google-login-ticket' }, configuredEnv.JWT_SECRET, { expiresIn: '2m' });

      await expect(service.exchangeTicket(ticket)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('BUG-21: handleCallback mints tickets with a unique jti', async () => {
      const service = loadService(configuredEnv);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a' } });
      mockUserinfoGet.mockResolvedValue({ data: { id: 'g-uniq', email: 'u@example.com' } });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 7, googleId: 'g-uniq', email: 'u@example.com' });

      const state = () => jwt.sign({ purpose: 'google-login' }, configuredEnv.JWT_SECRET, { expiresIn: '10m' });
      const a = await service.handleCallback('code', state());
      const b = await service.handleCallback('code', state());
      const ja = (jwt.decode((a as any).ticket) as jwt.JwtPayload).jti;
      const jb = (jwt.decode((b as any).ticket) as jwt.JwtPayload).jti;
      expect(ja).toBeTruthy();
      expect(ja).not.toBe(jb);
    });

    it('returns {accessToken, user} without the password, matching register/login\'s shape', async () => {
      const service = loadService(configuredEnv);
      const ticket = jwt.sign({ sub: 55, purpose: 'google-login-ticket' }, configuredEnv.JWT_SECRET, { expiresIn: '2m', jwtid: 'jti-55' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 55,
        username: 'someone',
        email: 'someone@example.com',
        password: null,
        googleId: 'g1',
      });

      const result = await service.exchangeTicket(ticket);

      expect(result.accessToken).toBeDefined();
      expect(result.user).toEqual({ id: 55, username: 'someone', email: 'someone@example.com', googleId: 'g1' });
      expect((result.user as any).password).toBeUndefined();
    });
  });
});
