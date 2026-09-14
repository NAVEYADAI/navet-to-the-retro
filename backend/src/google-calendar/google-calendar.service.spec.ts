import { UnauthorizedException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { GoogleCalendarService } from './google-calendar.service';

// `googleapis` is fully mocked — no real network call ever leaves this process. Mirrors the
// pattern already established for `resend` in email.service.spec.ts.
const mockGenerateAuthUrl = jest.fn();
const mockGetToken = jest.fn();
const mockSetCredentials = jest.fn();
const mockUserinfoGet = jest.fn();
const mockEventsInsert = jest.fn();
const mockEventsPatch = jest.fn();
const mockCalendarsInsert = jest.fn();
const mockOAuth2On = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        setCredentials: mockSetCredentials,
        on: mockOAuth2On,
      })),
    },
    oauth2: jest.fn().mockImplementation(() => ({
      userinfo: { get: mockUserinfoGet },
    })),
    calendar: jest.fn().mockImplementation(() => ({
      events: { insert: mockEventsInsert, patch: mockEventsPatch },
      calendars: { insert: mockCalendarsInsert },
    })),
  },
}));

describe('GoogleCalendarService', () => {
  const originalEnv = process.env;

  const mockPrisma = {
    googleCalendarConnection: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    sprintGoogleEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    googleCalendarTeamCalendar: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
    },
    sprint: {
      findMany: jest.fn(),
    },
  };

  const configuredEnv = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:5005/google-calendar/callback',
    JWT_SECRET: 'test-jwt-secret',
  };

  const sprintInfo = {
    sprintId: 5,
    teamId: 1,
    name: 'Sprint 1',
    teamName: 'Core Team',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-14T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // `GoogleCalendarService` only reads `process.env.GOOGLE_*`/`JWT_SECRET` in its constructor
  // field initializers (not at module-load time), so a plain `new` per test with the desired env
  // already set is enough — no need for `jest.resetModules()` + `require()` (which would also
  // reload `@nestjs/common` and break `instanceof`/`toThrow(SomeExceptionClass)` checks against
  // the statically-imported exception classes above).
  function loadService(env: Record<string, string> = {}) {
    process.env = { ...originalEnv, ...env };
    return new GoogleCalendarService(mockPrisma as any);
  }

  describe('getAuthUrl', () => {
    it('throws when GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI are not fully configured', () => {
      const service = loadService({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_REDIRECT_URI: '' });

      expect(() => service.getAuthUrl(1)).toThrow(InternalServerErrorException);
    });

    it('returns the generated URL and signs the userId into `state`', () => {
      mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
      const service = loadService(configuredEnv);

      const url = service.getAuthUrl(42);

      expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
      const [[callArgs]] = mockGenerateAuthUrl.mock.calls;
      expect(callArgs.scope).toEqual([
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email'
      ]);
      const payload = jwt.verify(callArgs.state, configuredEnv.JWT_SECRET) as jwt.JwtPayload;
      expect(payload.sub).toBe(42);
      expect(callArgs.login_hint).toBeUndefined();
    });

    it('passes login_hint when the caller has an email, so Google pre-selects the matching account', () => {
      mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
      const service = loadService(configuredEnv);

      service.getAuthUrl(42, 'me@example.com');

      const [[callArgs]] = mockGenerateAuthUrl.mock.calls;
      expect(callArgs.login_hint).toBe('me@example.com');
    });
  });

  describe('getStatus', () => {
    it('returns connected:false when there is no active connection', async () => {
      mockPrisma.googleCalendarConnection.findFirst.mockResolvedValue(null);
      const service = loadService(configuredEnv);

      await expect(service.getStatus(1)).resolves.toEqual({ connected: false });
    });

    it('returns connected:true with the google account email when a connection exists', async () => {
      mockPrisma.googleCalendarConnection.findFirst.mockResolvedValue({ googleAccountEmail: 'a@b.com' });
      const service = loadService(configuredEnv);

      await expect(service.getStatus(1)).resolves.toEqual({ connected: true, googleAccountEmail: 'a@b.com' });
    });
  });

  describe('handleCallback', () => {
    it('throws when Google Calendar is not configured', async () => {
      const service = loadService({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_REDIRECT_URI: '' });

      await expect(service.handleCallback('code', 'state')).rejects.toThrow(InternalServerErrorException);
    });

    it('throws UnauthorizedException when `state` is invalid or expired', async () => {
      const service = loadService(configuredEnv);

      await expect(service.handleCallback('code', 'not-a-real-jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when `state` is validly signed but carries the wrong purpose (2026-09-14 security fix)', async () => {
      // Pins the fix: a `state`/ticket minted by the *other* Google flow (GoogleLoginService),
      // sharing the same JWT_SECRET, must not be accepted here.
      const service = loadService(configuredEnv);
      const wrongPurposeState = jwt.sign({ sub: 7, purpose: 'google-login' }, configuredEnv.JWT_SECRET);

      await expect(service.handleCallback('code', wrongPurposeState)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when Google does not return both tokens', async () => {
      const service = loadService(configuredEnv);
      const state = jwt.sign({ sub: 7, purpose: 'google-calendar-connect' }, configuredEnv.JWT_SECRET);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'only-access' } });

      await expect(service.handleCallback('code', state)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the Google userinfo call has no email', async () => {
      const service = loadService(configuredEnv);
      const state = jwt.sign({ sub: 7, purpose: 'google-calendar-connect' }, configuredEnv.JWT_SECRET);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a', refresh_token: 'r', expiry_date: 123 } });
      mockUserinfoGet.mockResolvedValue({ data: {} });

      await expect(service.handleCallback('code', state)).rejects.toThrow(UnauthorizedException);
    });

    it('stores a new connection for the user encoded in `state` on success', async () => {
      const service = loadService(configuredEnv);
      const state = jwt.sign({ sub: 7, purpose: 'google-calendar-connect' }, configuredEnv.JWT_SECRET);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a', refresh_token: 'r', expiry_date: 1999999999000 } });
      mockUserinfoGet.mockResolvedValue({ data: { email: 'me@gmail.com' } });
      mockPrisma.googleCalendarConnection.create.mockResolvedValue({ id: 1 });
      mockPrisma.teamMember.findMany.mockResolvedValue([]); // no teams -> nothing to backfill

      await service.handleCallback('code', state);

      expect(mockPrisma.googleCalendarConnection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 7,
          accessToken: 'a',
          refreshToken: 'r',
          googleAccountEmail: 'me@gmail.com',
          isRevoked: false,
        }),
      });
    });

    it('backfills an event for every pre-existing sprint across all the user\'s active teams', async () => {
      const service = loadService(configuredEnv);
      const state = jwt.sign({ sub: 7, purpose: 'google-calendar-connect' }, configuredEnv.JWT_SECRET);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a', refresh_token: 'r', expiry_date: 1999999999000 } });
      mockUserinfoGet.mockResolvedValue({ data: { email: 'me@gmail.com' } });
      mockPrisma.googleCalendarConnection.create.mockResolvedValue({ id: 1, userId: 7, accessToken: 'a', refreshToken: 'r' });
      mockPrisma.teamMember.findMany.mockResolvedValue([{ teamId: 1 }, { teamId: 2 }]);
      mockPrisma.sprint.findMany.mockResolvedValue([
        { id: 100, teamId: 1, name: 'Old Sprint', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-14'), team: { name: 'Team A' } },
      ]);
      mockPrisma.googleCalendarTeamCalendar.findUnique.mockResolvedValue({ calendarId: 'cal-a' });
      mockEventsInsert.mockResolvedValue({ data: { id: 'backfilled-event' } });

      await service.handleCallback('code', state);

      expect(mockPrisma.sprint.findMany).toHaveBeenCalledWith({
        where: { teamId: { in: [1, 2] } },
        include: { team: { select: { name: true } } },
      });
      expect(mockEventsInsert).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'cal-a', requestBody: expect.objectContaining({ summary: 'Old Sprint' }) })
      );
      expect(mockPrisma.sprintGoogleEvent.create).toHaveBeenCalledWith({
        data: { sprintId: 100, connectionId: 1, googleEventId: 'backfilled-event' },
      });
    });

    it('still returns the saved connection when the backfill itself fails', async () => {
      const service = loadService(configuredEnv);
      const state = jwt.sign({ sub: 7, purpose: 'google-calendar-connect' }, configuredEnv.JWT_SECRET);
      mockGetToken.mockResolvedValue({ tokens: { access_token: 'a', refresh_token: 'r', expiry_date: 1999999999000 } });
      mockUserinfoGet.mockResolvedValue({ data: { email: 'me@gmail.com' } });
      mockPrisma.googleCalendarConnection.create.mockResolvedValue({ id: 1, userId: 7, accessToken: 'a', refreshToken: 'r' });
      mockPrisma.teamMember.findMany.mockRejectedValue(new Error('db is down'));

      const result = await service.handleCallback('code', state);

      expect(result).toEqual({ id: 1, userId: 7, accessToken: 'a', refreshToken: 'r' });
    });
  });

  describe('disconnect', () => {
    it('throws NotFoundException when there is no active connection', async () => {
      mockPrisma.googleCalendarConnection.findFirst.mockResolvedValue(null);
      const service = loadService(configuredEnv);

      await expect(service.disconnect(1)).rejects.toThrow(NotFoundException);
    });

    it('marks the active connection isRevoked=true (soft-delete, not a hard delete)', async () => {
      mockPrisma.googleCalendarConnection.findFirst.mockResolvedValue({ id: 9, userId: 1 });
      mockPrisma.googleCalendarConnection.update.mockResolvedValue({ id: 9, isRevoked: true });
      const service = loadService(configuredEnv);

      await service.disconnect(1);

      expect(mockPrisma.googleCalendarConnection.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { isRevoked: true },
      });
    });
  });

  describe('syncSprintCreated', () => {
    it('does nothing when Google Calendar is not configured', async () => {
      const service = loadService({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_REDIRECT_URI: '' });

      await service.syncSprintCreated(sprintInfo);

      expect(mockPrisma.teamMember.findMany).not.toHaveBeenCalled();
    });

    it('only considers ACTIVE team members when looking up connections (2026-09-14 bug fix: a PENDING member with a connection from another team must not get an event)', async () => {
      mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: 1 }]);
      mockPrisma.googleCalendarConnection.findMany.mockResolvedValue([]);
      const service = loadService(configuredEnv);

      await service.syncSprintCreated(sprintInfo);

      expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
        where: { teamId: sprintInfo.teamId, status: 'ACTIVE' },
        select: { userId: true },
      });
    });

    it('creates an all-day event (end date exclusive) for every active connection of a team member, in a per-team calendar created on demand', async () => {
      mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
      const connections = [
        { id: 10, userId: 1, accessToken: 'a1', refreshToken: 'r1', isRevoked: false },
      ];
      mockPrisma.googleCalendarConnection.findMany.mockResolvedValue(connections);
      mockPrisma.googleCalendarTeamCalendar.findUnique.mockResolvedValue(null); // no calendar yet
      mockCalendarsInsert.mockResolvedValue({ data: { id: 'new-cal-1' } });
      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-event-1' } });
      const service = loadService(configuredEnv);

      await service.syncSprintCreated(sprintInfo);

      expect(mockCalendarsInsert).toHaveBeenCalledWith({
        requestBody: { summary: `${sprintInfo.teamName} — ספרינטים` },
      });
      expect(mockPrisma.googleCalendarTeamCalendar.create).toHaveBeenCalledWith({
        data: { connectionId: 10, teamId: sprintInfo.teamId, calendarId: 'new-cal-1' },
      });
      expect(mockEventsInsert).toHaveBeenCalledWith({
        calendarId: 'new-cal-1',
        requestBody: expect.objectContaining({
          summary: sprintInfo.name,
          start: { date: '2026-01-01' },
          // endDate 2026-01-14 -> exclusive end is the day after
          end: { date: '2026-01-15' },
        }),
      });
      expect(mockPrisma.sprintGoogleEvent.create).toHaveBeenCalledWith({
        data: { sprintId: sprintInfo.sprintId, connectionId: 10, googleEventId: 'gcal-event-1' },
      });
    });

    it('reuses an already-created team calendar instead of creating a second one', async () => {
      mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: 1 }]);
      mockPrisma.googleCalendarConnection.findMany.mockResolvedValue([
        { id: 10, userId: 1, accessToken: 'a1', refreshToken: 'r1', isRevoked: false },
      ]);
      mockPrisma.googleCalendarTeamCalendar.findUnique.mockResolvedValue({ calendarId: 'existing-cal' });
      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-event-1' } });
      const service = loadService(configuredEnv);

      await service.syncSprintCreated(sprintInfo);

      expect(mockCalendarsInsert).not.toHaveBeenCalled();
      expect(mockPrisma.googleCalendarTeamCalendar.create).not.toHaveBeenCalled();
      expect(mockEventsInsert).toHaveBeenCalledWith(expect.objectContaining({ calendarId: 'existing-cal' }));
    });

    it('logs and swallows a failure on one connection without throwing or blocking others', async () => {
      mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
      const connections = [
        { id: 10, userId: 1, accessToken: 'a1', refreshToken: 'r1', isRevoked: false },
        { id: 11, userId: 2, accessToken: 'a2', refreshToken: 'r2', isRevoked: false },
      ];
      mockPrisma.googleCalendarConnection.findMany.mockResolvedValue(connections);
      mockPrisma.googleCalendarTeamCalendar.findUnique.mockResolvedValue({ calendarId: 'existing-cal' });
      mockEventsInsert
        .mockRejectedValueOnce(new Error('google is down'))
        .mockResolvedValueOnce({ data: { id: 'gcal-event-2' } });
      const service = loadService(configuredEnv);

      await expect(service.syncSprintCreated(sprintInfo)).resolves.toBeUndefined();

      expect(mockEventsInsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.sprintGoogleEvent.create).toHaveBeenCalledTimes(1);
    });

    it('logs and swallows a failure to create the team calendar itself, without throwing or blocking other connections', async () => {
      mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
      mockPrisma.googleCalendarConnection.findMany.mockResolvedValue([
        { id: 10, userId: 1, accessToken: 'a1', refreshToken: 'r1', isRevoked: false },
        { id: 11, userId: 2, accessToken: 'a2', refreshToken: 'r2', isRevoked: false },
      ]);
      mockPrisma.googleCalendarTeamCalendar.findUnique
        .mockRejectedValueOnce(new Error('db is down'))
        .mockResolvedValueOnce({ calendarId: 'existing-cal' });
      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-event-2' } });
      const service = loadService(configuredEnv);

      await expect(service.syncSprintCreated(sprintInfo)).resolves.toBeUndefined();

      expect(mockEventsInsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sprintGoogleEvent.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncSprintUpdated', () => {
    it('does nothing when Google Calendar is not configured', async () => {
      const service = loadService({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_REDIRECT_URI: '' });

      await service.syncSprintUpdated(sprintInfo);

      expect(mockPrisma.sprintGoogleEvent.findMany).not.toHaveBeenCalled();
    });

    it('patches the existing event for every active connection already linked to the sprint, in that team\'s existing calendar', async () => {
      mockPrisma.sprintGoogleEvent.findMany.mockResolvedValue([
        {
          connectionId: 10,
          googleEventId: 'gcal-event-1',
          connection: { id: 10, accessToken: 'a1', refreshToken: 'r1', isRevoked: false },
        },
      ]);
      mockPrisma.googleCalendarTeamCalendar.findUnique.mockResolvedValue({ calendarId: 'existing-cal' });
      const service = loadService(configuredEnv);

      await service.syncSprintUpdated(sprintInfo);

      expect(mockCalendarsInsert).not.toHaveBeenCalled();
      expect(mockEventsPatch).toHaveBeenCalledWith({
        calendarId: 'existing-cal',
        eventId: 'gcal-event-1',
        requestBody: expect.objectContaining({
          summary: sprintInfo.name,
          start: { date: '2026-01-01' },
          end: { date: '2026-01-15' },
        }),
      });
    });

    it('logs and swallows a patch failure instead of throwing', async () => {
      mockPrisma.sprintGoogleEvent.findMany.mockResolvedValue([
        {
          connectionId: 10,
          googleEventId: 'gcal-event-1',
          connection: { id: 10, accessToken: 'a1', refreshToken: 'r1', isRevoked: false },
        },
      ]);
      mockPrisma.googleCalendarTeamCalendar.findUnique.mockResolvedValue({ calendarId: 'existing-cal' });
      mockEventsPatch.mockRejectedValue(new Error('google is down'));
      const service = loadService(configuredEnv);

      await expect(service.syncSprintUpdated(sprintInfo)).resolves.toBeUndefined();
    });
  });

  describe('token refresh persistence (2026-09-14 bug fix)', () => {
    // Before this fix, google-auth-library's silent in-memory refresh of an expired access token
    // was never written back to the DB — every subsequent call re-refreshed from the same stale
    // row. `buildCalendarClient` (private, exercised here via `syncSprintCreated`) now registers a
    // `client.on('tokens', ...)` listener that persists a refreshed access token back to the
    // connection's row.
    it("persists a refreshed access token back to the connection's row when google-auth-library refreshes one", async () => {
      let tokensListener: ((tokens: { access_token?: string; expiry_date?: number; refresh_token?: string }) => void) | undefined;
      mockOAuth2On.mockImplementation((event: string, cb: typeof tokensListener) => {
        if (event === 'tokens') tokensListener = cb;
      });
      mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: 1 }]);
      mockPrisma.googleCalendarConnection.findMany.mockResolvedValue([
        { id: 10, userId: 1, accessToken: 'stale-access', refreshToken: 'r1', isRevoked: false },
      ]);
      mockPrisma.googleCalendarTeamCalendar.findUnique.mockResolvedValue({ calendarId: 'existing-cal' });
      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-event-1' } });
      mockPrisma.googleCalendarConnection.update.mockResolvedValue({});
      const service = loadService(configuredEnv);

      await service.syncSprintCreated(sprintInfo);
      expect(tokensListener).toBeDefined();

      tokensListener!({ access_token: 'refreshed-access', expiry_date: 1999999999000 });

      expect(mockPrisma.googleCalendarConnection.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          accessToken: 'refreshed-access',
          expiresAt: new Date(1999999999000),
        },
      });
    });

    it('never overwrites the stored refresh token with undefined when Google only rotates the access token', async () => {
      let tokensListener: ((tokens: { access_token?: string; expiry_date?: number; refresh_token?: string }) => void) | undefined;
      mockOAuth2On.mockImplementation((event: string, cb: typeof tokensListener) => {
        if (event === 'tokens') tokensListener = cb;
      });
      mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: 1 }]);
      mockPrisma.googleCalendarConnection.findMany.mockResolvedValue([
        { id: 10, userId: 1, accessToken: 'stale-access', refreshToken: 'r1', isRevoked: false },
      ]);
      mockPrisma.googleCalendarTeamCalendar.findUnique.mockResolvedValue({ calendarId: 'existing-cal' });
      mockEventsInsert.mockResolvedValue({ data: { id: 'gcal-event-1' } });
      mockPrisma.googleCalendarConnection.update.mockResolvedValue({});
      const service = loadService(configuredEnv);

      await service.syncSprintCreated(sprintInfo);
      tokensListener!({ access_token: 'refreshed-access', expiry_date: 1999999999000, refresh_token: 'rotated-refresh' });

      expect(mockPrisma.googleCalendarConnection.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          accessToken: 'refreshed-access',
          expiresAt: new Date(1999999999000),
          refreshToken: 'rotated-refresh',
        },
      });
    });
  });
});
