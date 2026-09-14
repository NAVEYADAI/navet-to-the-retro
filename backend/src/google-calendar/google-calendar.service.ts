import { Injectable, Logger, UnauthorizedException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma.service';

// `calendar.events` only covers reading/writing events on calendars that already exist — it does
// NOT allow creating a new (secondary) calendar. Since `getOrCreateTeamCalendar` calls
// `calendars.insert()` to create the per-team calendar, the broader `calendar` scope is required,
// or Google rejects that specific call with "Request had insufficient authentication scopes"
// (bug found 2026-09-11 via a real connect attempt, right after the per-team-calendar feature
// shipped — `calendar.events` alone was enough before that feature existed).
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
// `handleCallback` below calls `oauth2.userinfo.get()` to learn the connected account's email
// (for the "מחובר כ-X" display) — that endpoint requires the `email` scope specifically, not
// just `calendar.events`. Omitting it made every real connect attempt fail with a generic
// "missing required authentication credential" error from Google, since the access token had
// no permission to call userinfo at all. Bug found 2026-09-11 via a real connect attempt.
const USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

// Sprint dates are date-only in practice (see product-backlog/06-google-calendar-integration.md §6.0 default #2) and are
// stored as UTC midnight, so `toISOString().slice(0, 10)` round-trips them correctly into the
// `YYYY-MM-DD` shape Google's all-day event fields expect.
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Google Calendar's all-day event `end.date` is exclusive — an event meant to cover the sprint's
// last day inclusive needs `end.date` set to the day *after* `endDate`, or the last day won't
// render as part of the event.
function toExclusiveEndDateOnly(endDate: Date): string {
  const exclusiveEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  return toDateOnly(exclusiveEnd);
}

export interface SprintCalendarInfo {
  sprintId: number;
  teamId: number;
  name: string;
  teamName: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private readonly redirectUri = process.env.GOOGLE_REDIRECT_URI;
  // The OAuth `state` param just needs to be tamper-proof, short-lived carrier for "which user
  // started this connect flow" across the redirect to Google and back — reusing AuthService's
  // JWT secret/scheme avoids introducing a second secret to manage in infisical for the same
  // purpose. Not a session token; never sent back to the client as one.
  private readonly jwtSecret = process.env.JWT_SECRET || 'retro-secret-key-12345';

  constructor(private readonly prisma: PrismaService) {
    if (!this.isConfigured()) {
      this.logger.warn('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI not fully set — Google Calendar connect/disconnect is disabled and sprint sync will be skipped.');
    }
  }

  private isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException('שילוב יומן Google אינו מוגדר כרגע בשרת');
    }
  }

  private createOAuthClient() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }

  /**
   * Builds the Google consent-screen URL for a given user; `state` carries the signed userId.
   * `login_hint` (2026-09-13, Nave's report) pre-selects the Google account matching the user's
   * app email instead of Google defaulting to whichever account happens to be first/last-active
   * in the browser — a user with multiple signed-in Google accounts was being asked "which
   * account?" instead of the one they'd expect. This is a hint, not an enforcement: the user can
   * still pick a different Google account in the picker if they want to connect a different one.
   */
  getAuthUrl(userId: number, loginHintEmail?: string): string {
    this.assertConfigured();
    const client = this.createOAuthClient();
    // `purpose` (2026-09-14, security fix found in code review): without this, a leaked `state`
    // (it briefly appears in a URL sent to accounts.google.com) was a bare `{sub}` JWT
    // indistinguishable from a real session token or a Google-login ticket signed with the same
    // secret — replayable as either. `AuthService.validateToken` now rejects any token carrying
    // a `purpose` claim, and `handleCallback` below now checks this exact value.
    const state = jwt.sign({ sub: userId, purpose: 'google-calendar-connect' }, this.jwtSecret, { expiresIn: '10m' });
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      ...(loginHintEmail ? { login_hint: loginHintEmail } : {}),
      scope: [CALENDAR_SCOPE, USERINFO_EMAIL_SCOPE],
      state
    });
  }

  /** Current connection status for the given user — used by the settings-screen card. */
  async getStatus(userId: number) {
    const connection = await this.prisma.googleCalendarConnection.findFirst({
      where: { userId, isRevoked: false },
      orderBy: { createdAt: 'desc' }
    });
    return connection
      ? { connected: true as const, googleAccountEmail: connection.googleAccountEmail }
      : { connected: false as const };
  }

  /** Exchanges the OAuth `code` for tokens and stores a new connection for the user in `state`. */
  async handleCallback(code: string, state: string) {
    this.assertConfigured();

    let userId: number;
    try {
      const payload = jwt.verify(state, this.jwtSecret) as jwt.JwtPayload & { purpose?: string };
      if (payload.purpose !== 'google-calendar-connect') {
        throw new Error('wrong token purpose');
      }
      userId = payload.sub as unknown as number;
    } catch {
      throw new UnauthorizedException('קישור החיבור פג תוקף או אינו תקין, נסה/י שוב');
    }

    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new UnauthorizedException('Google לא סיפק הרשאות מלאות לחיבור היומן — נסה/י לחבר שוב');
    }
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();
    if (!data.email) {
      throw new UnauthorizedException('לא ניתן היה לזהות את כתובת חשבון Google');
    }

    const connection = await this.prisma.googleCalendarConnection.create({
      data: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 60 * 60 * 1000),
        googleAccountEmail: data.email,
        isRevoked: false
      }
    });

    // Best-effort — a backfill failure must never fail the connect flow itself (the connection
    // is already saved above); same "never block on Google" philosophy as sprint sync.
    try {
      await this.backfillExistingSprints(connection);
    } catch (err) {
      this.logger.warn(
        `Failed to backfill existing sprints for new connection ${connection.id}`,
        err instanceof Error ? err.stack : err
      );
    }

    return connection;
  }

  /** Revokes (soft-disconnects) the requester's own active connection, if any. */
  async disconnect(userId: number) {
    const connection = await this.prisma.googleCalendarConnection.findFirst({
      where: { userId, isRevoked: false },
      orderBy: { createdAt: 'desc' }
    });
    if (!connection) {
      throw new NotFoundException('אין חיבור פעיל ליומן Google');
    }
    return this.prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { isRevoked: true }
    });
  }

  private buildCalendarClient(connection: { id: number; accessToken: string; refreshToken: string }) {
    const client = this.createOAuthClient();
    client.setCredentials({ access_token: connection.accessToken, refresh_token: connection.refreshToken });
    // Persist a silent refresh (2026-09-14, found in code review): google-auth-library refreshes
    // the access token in-memory on its own whenever the stored one has expired, but without
    // this listener the refreshed token was discarded — every subsequent call re-refreshed from
    // the same stale DB row (an extra round trip every time, forever) and `expiresAt` stayed
    // permanently wrong. Fire-and-forget is fine here: a failed write just means the next call
    // refreshes again, no different from today's behavior.
    client.on('tokens', (tokens) => {
      if (!tokens.access_token) return;
      this.prisma.googleCalendarConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: tokens.access_token,
          expiresAt: new Date(tokens.expiry_date ?? Date.now() + 60 * 60 * 1000),
          // Google only returns a new refresh_token on rare rotation — never overwrite the
          // existing one with `undefined`.
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {})
        }
      }).catch((err) => {
        this.logger.warn(
          `Failed to persist refreshed Google access token for connection ${connection.id}`,
          err instanceof Error ? err.stack : err
        );
      });
    });
    return google.calendar({ version: 'v3', auth: client });
  }

  /**
   * Returns the dedicated secondary calendar id for this (connection, team), creating it on
   * Google's side (and recording it) the first time this pair is synced. Deliberately per-team,
   * not per-connection/"primary" — Nave asked (2026-09-11) that each team's sprint events land
   * in their own show/hide-able calendar rather than mixed into the user's personal one.
   */
  private async getOrCreateTeamCalendar(
    connection: { id: number; accessToken: string; refreshToken: string },
    teamId: number,
    teamName: string
  ): Promise<string> {
    const existing = await this.prisma.googleCalendarTeamCalendar.findUnique({
      where: { connectionId_teamId: { connectionId: connection.id, teamId } }
    });
    if (existing) {
      return existing.calendarId;
    }

    const calendar = this.buildCalendarClient(connection);
    const { data } = await calendar.calendars.insert({
      requestBody: { summary: `${teamName} — ספרינטים` }
    });
    if (!data.id) {
      throw new Error(`Google did not return an id for the newly-created "${teamName}" calendar`);
    }

    await this.prisma.googleCalendarTeamCalendar.create({
      data: { connectionId: connection.id, teamId, calendarId: data.id }
    });
    return data.id;
  }

  /**
   * Creates the all-day event for one sprint on one connection (get-or-create the team calendar,
   * insert the event, record the `SprintGoogleEvent` link). Caller is responsible for catching —
   * this throws on any failure rather than swallowing it, so it can be reused both by the
   * per-team loop (`syncSprintCreated`, many connections/one sprint) and the per-connection
   * backfill (`backfillExistingSprints`, one connection/many sprints) with the same
   * catch-and-log-per-item discipline at whichever call site is looping.
   */
  private async createEventForConnection(
    connection: { id: number; accessToken: string; refreshToken: string },
    sprint: SprintCalendarInfo
  ): Promise<void> {
    const calendarId = await this.getOrCreateTeamCalendar(connection, sprint.teamId, sprint.teamName);
    const calendar = this.buildCalendarClient(connection);
    const { data } = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: sprint.name,
        description: `ספרינט של הצוות ${sprint.teamName}`,
        start: { date: toDateOnly(sprint.startDate) },
        end: { date: toExclusiveEndDateOnly(sprint.endDate) }
      }
    });

    if (data.id) {
      await this.prisma.sprintGoogleEvent.create({
        data: { sprintId: sprint.sprintId, connectionId: connection.id, googleEventId: data.id }
      });
    }
  }

  /**
   * Creates an all-day Google Calendar event for a newly-created sprint on every active Google
   * connection belonging to a member of the sprint's team. Follows the same
   * external-service-failure pattern as `EmailService`: each connection's failure is caught and
   * logged individually, never thrown — a Google Calendar outage must never block sprint
   * creation, and one member's broken connection must never block another's event.
   */
  async syncSprintCreated(sprint: SprintCalendarInfo): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    // `status: 'ACTIVE'` (2026-09-14, bug found in code review): this was missing here while
    // `backfillExistingSprints` below already filters on it — without it, a user who was just
    // `addMember`'d but hasn't accepted yet (still `PENDING`) and already has an active Google
    // connection from a different team gets a calendar event for a sprint on a team they aren't
    // an active member of yet.
    const members = await this.prisma.teamMember.findMany({ where: { teamId: sprint.teamId, status: 'ACTIVE' }, select: { userId: true } });
    if (members.length === 0) return;

    const connections = await this.prisma.googleCalendarConnection.findMany({
      where: { userId: { in: members.map((m) => m.userId) }, isRevoked: false }
    });

    for (const connection of connections) {
      try {
        await this.createEventForConnection(connection, sprint);
      } catch (err) {
        this.logger.warn(
          `Failed to create Google Calendar event for sprint ${sprint.sprintId} on connection ${connection.id}`,
          err instanceof Error ? err.stack : err
        );
      }
    }
  }

  /**
   * Backfills events for every sprint the connecting user already has access to (across every
   * team they're an active member of), the first time they connect. Without this, a user who
   * connects after sprints already exist would only ever see *future* sprints synced — Nave
   * flagged this as confusing (2026-09-11): "I connected the calendar, why don't I see the
   * existing sprint?" `syncSprintCreated`/`syncSprintUpdated` only fire from
   * `sprints.service.ts` at the moment of creation/update, so a one-time catch-up here is the
   * only way pre-existing sprints ever get an event for a newly-connected user. Same
   * catch-and-log-per-item discipline as `syncSprintCreated` — one bad sprint never blocks the
   * rest, and any failure here must never fail the connect flow itself (see caller).
   */
  private async backfillExistingSprints(connection: { id: number; userId: number; accessToken: string; refreshToken: string }): Promise<void> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: connection.userId, status: 'ACTIVE' },
      select: { teamId: true }
    });
    if (memberships.length === 0) return;

    const sprints = await this.prisma.sprint.findMany({
      where: { teamId: { in: memberships.map((m) => m.teamId) } },
      include: { team: { select: { name: true } } }
    });

    for (const sprint of sprints) {
      try {
        await this.createEventForConnection(connection, {
          sprintId: sprint.id,
          teamId: sprint.teamId,
          name: sprint.name,
          teamName: sprint.team.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate
        });
      } catch (err) {
        this.logger.warn(
          `Failed to backfill Google Calendar event for pre-existing sprint ${sprint.id} on new connection ${connection.id}`,
          err instanceof Error ? err.stack : err
        );
      }
    }
  }

  /**
   * Patches the existing Google Calendar event(s) for a sprint whose dates changed, one per
   * active connection that already has a linked event. Same catch-and-log-per-connection
   * pattern as `syncSprintCreated` — never blocks the sprint update itself.
   */
  async syncSprintUpdated(sprint: SprintCalendarInfo): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    const links = await this.prisma.sprintGoogleEvent.findMany({
      where: { sprintId: sprint.sprintId, connection: { isRevoked: false } },
      include: { connection: true }
    });

    for (const link of links) {
      try {
        const calendarId = await this.getOrCreateTeamCalendar(link.connection, sprint.teamId, sprint.teamName);
        const calendar = this.buildCalendarClient(link.connection);
        await calendar.events.patch({
          calendarId,
          eventId: link.googleEventId,
          requestBody: {
            summary: sprint.name,
            description: `ספרינט של הצוות ${sprint.teamName}`,
            start: { date: toDateOnly(sprint.startDate) },
            end: { date: toExclusiveEndDateOnly(sprint.endDate) }
          }
        });
      } catch (err) {
        this.logger.warn(
          `Failed to update Google Calendar event for sprint ${sprint.sprintId} on connection ${link.connectionId}`,
          err instanceof Error ? err.stack : err
        );
      }
    }
  }
}
