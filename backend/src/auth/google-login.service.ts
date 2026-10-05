import { Injectable, Logger, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma.service';

// Narrower than Feature 6's calendar scope on purpose (product-backlog/07-google-sign-in.md §7.0 default #1):
// login only needs to identify the user, not obtain a long-lived refresh token, so there's no
// `access_type:'offline'`/`prompt:'consent'` here either.
const LOGIN_SCOPES = ['openid', 'email', 'profile'];

@Injectable()
export class GoogleLoginService {
  private readonly logger = new Logger(GoogleLoginService.name);
  // Deliberate small duplication of GoogleCalendarService's ~10-line OAuth2-client construction
  // rather than sharing an instance/module — see product-backlog/07-google-sign-in.md §7.0 default #2:
  // `GoogleCalendarModule` already imports `AuthModule`, so the reverse import would create a
  // circular module dependency. Same `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` as Feature 6
  // (same Google Cloud OAuth client, reused on purpose), but a distinct redirect URI so Google
  // can tell the two flows apart.
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private readonly redirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI;
  private readonly jwtSecret = process.env.JWT_SECRET || 'retro-secret-key-12345';

  constructor(private readonly prisma: PrismaService) {
    if (!this.isConfigured()) {
      this.logger.warn(
        'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_LOGIN_REDIRECT_URI not fully set — Sign in with Google is disabled.'
      );
    }
  }

  private isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException('התחברות עם Google אינה מוגדרת כרגע בשרת');
    }
  }

  private createOAuthClient() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }

  /**
   * Builds the Google consent-screen URL for the login flow. Unlike
   * `GoogleCalendarService.getAuthUrl`, there is no `userId` to carry yet — the user isn't
   * identified/authenticated at all at this point in the flow — so `state` here is a plain
   * short-lived anti-CSRF nonce, not an identity carrier.
   */
  getAuthUrl(): string {
    this.assertConfigured();
    const client = this.createOAuthClient();
    const state = jwt.sign({ purpose: 'google-login' }, this.jwtSecret, { expiresIn: '10m' });
    return client.generateAuthUrl({
      scope: LOGIN_SCOPES,
      state
    });
  }

  /**
   * Exchanges the OAuth `code` for tokens and resolves the Google profile against existing
   * `User` rows. Two outcomes (2026-09-13, Nave's request):
   * - A matching account already exists (by `googleId`, or auto-linked by email) → issue the
   *   normal short-lived "ticket" (product-backlog/07-google-sign-in.md §7.0 default #5) that logs them straight
   *   in. This is true regardless of whether the user clicked "Google" from the login screen or
   *   the register screen — an existing account always just signs in.
   * - No match at all (a genuinely new identity) → do NOT create the account here. Instead
   *   return a "pending" ticket carrying the verified Google profile, so the frontend can show a
   *   role-picker step (parity with the password-registration form, which already asks for a
   *   role) before the account is actually created. This is also what makes clicking "Google"
   *   from the LOGIN screen for an unregistered identity work correctly: instead of silently
   *   creating a DEVELOPER account, it lands on the same pending-registration step — the user
   *   ends up completing registration without ever repeating the Google consent screen.
   */
  async handleCallback(code: string, state: string): Promise<{ ticket: string } | { pendingTicket: string }> {
    this.assertConfigured();

    try {
      const statePayload = jwt.verify(state, this.jwtSecret) as jwt.JwtPayload & { purpose?: string };
      // Security fix (2026-09-14, found in code review): `purpose` was already being signed
      // into this token, but never actually checked on the way back in — verifying it (instead
      // of just checking the signature/expiry) stops a leaked `state` from a *different* flow
      // (e.g. GoogleCalendarService's connect `state`, signed with the same secret) from being
      // replayed here.
      if (statePayload.purpose !== 'google-login') {
        throw new Error('wrong token purpose');
      }
    } catch {
      throw new UnauthorizedException('קישור ההתחברות פג תוקף או אינו תקין, נסה/י שוב');
    }

    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new UnauthorizedException('Google לא סיפק הרשאות מלאות להתחברות — נסה/י שוב');
    }
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();
    if (!data.email || !data.id) {
      throw new UnauthorizedException('לא ניתן היה לזהות את חשבון Google');
    }

    const profile = {
      googleId: data.id,
      email: data.email,
      firstName: data.given_name ?? undefined,
      lastName: data.family_name ?? undefined
    };

    const existing = await this.findExistingUser(profile);
    if (existing) {
      // `purpose` (2026-09-14, security fix): distinguishes this from a real 12h session token
      // and from GoogleCalendarService's connect `state` — both signed with the same secret,
      // and previously indistinguishable from this ticket by shape alone (`{sub}`). See
      // `AuthService.validateToken` and `exchangeTicket` below for where this is now enforced.
      return { ticket: jwt.sign({ sub: existing.id, purpose: 'google-login-ticket' }, this.jwtSecret, { expiresIn: '2m' }) };
    }

    // Longer expiry than the regular ticket — this one has to survive an actual UI step (picking
    // a role), not just an immediate redirect-and-consume.
    const pendingTicket = jwt.sign(
      { pendingGoogleSignup: true as const, ...profile },
      this.jwtSecret,
      { expiresIn: '10m' }
    );
    return { pendingTicket };
  }

  /**
   * Looks up (and, where applicable, auto-links) an existing `User` for this Google profile —
   * never creates one. Split out of the old combined `findOrCreateUser` so `handleCallback` can
   * decide "log straight in" vs "needs the role-picker step" (see above), and so
   * `completeGoogleRegistration` below can re-run the exact same check right before creating a
   * row, closing the race where a second signup attempt (or a fresh password registration on the
   * same email) slipped in while the pending ticket was still in the user's browser.
   */
  private async findExistingUser(profile: { googleId: string; email: string }) {
    const byGoogleId = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (byGoogleId) {
      return byGoogleId;
    }

    // Case-insensitive by design (product-backlog/07-google-sign-in.md §7.0 default #3) — deliberately not
    // repeating the case-sensitivity bug documented in specs/02-teams-and-approval.md §9.1.
    // `orderBy: id asc` just makes the "which row wins when several share this email" choice
    // deterministic for this run, not a real conflict resolution — see the comment below.
    const byEmail = await this.prisma.user.findFirst({
      where: { email: { equals: profile.email, mode: 'insensitive' } },
      orderBy: { id: 'asc' }
    });

    if (!byEmail) {
      return null;
    }

    // KNOWN UNRESOLVED EDGE CASE (product-backlog/07-google-sign-in.md §7.0 product decision #3, 2026-09-07,
    // also called out under "לא בטיפול"): `byEmail` might already be linked to a *different*
    // `googleId` than the one Google just returned here (or, more generally, several `User`
    // rows can now share the same `email` since `User.email @unique` was relaxed precisely
    // for this reason). We deliberately do NOT crash or block in that case — we just proceed
    // and treat this row as the match. Who "wins" ownership of the email address, whether the
    // other party gets notified, and what should happen on the next collision are all
    // explicitly deferred product decisions (Nave, 2026-09-07) — do not invent/resolve that
    // here without going back to product first.
    if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
      return byEmail;
    }
    if (!byEmail.googleId) {
      // §7.4 (2026-09-11): Google just proved ownership of this exact email address at the
      // moment of linking — record that, independent of the deferred collision question
      // above (that's "who owns it if two rows claim it," this is "is this specific proof
      // valid," which it is).
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.googleId,
          emailVerifiedAt: new Date(),
          // BUG-05: a password row whose email was never verified may belong to someone who only
          // *claimed* this address (pre-hijack). Google just proved the real owner, so the
          // unverified password is dropped — the owner signs in with Google from now on.
          ...(byEmail.emailVerifiedAt ? {} : { password: null }),
        }
      });
    }
    return byEmail;
  }

  /**
   * Completes a pending Google signup: verifies the ticket from `handleCallback`'s "no match"
   * branch, re-checks for a match (see race note on `findExistingUser` above — logs the user in
   * as-is if one now exists, ignoring the chosen role), and otherwise creates the account with
   * the role the user picked on the frontend's role-selection step (2026-09-13, Nave's request —
   * parity with password registration, which has always asked for a role).
   */
  async completeGoogleRegistration(pendingTicket: string, role: string | undefined) {
    let payload: jwt.JwtPayload & { pendingGoogleSignup?: true; googleId?: string; email?: string; firstName?: string; lastName?: string };
    try {
      payload = jwt.verify(pendingTicket, this.jwtSecret) as typeof payload;
      if (!payload.pendingGoogleSignup || !payload.googleId || !payload.email) {
        throw new Error('not a pending-signup ticket');
      }
    } catch {
      throw new UnauthorizedException('קישור ההרשמה פג תוקף או אינו תקין, נסה/י שוב');
    }

    const existing = await this.findExistingUser({ googleId: payload.googleId, email: payload.email });
    if (existing) {
      return this.issueSession(existing);
    }

    const username = await this.generateUniqueUsername(payload.email);
    const user = await this.prisma.user.create({
      data: {
        username,
        email: payload.email,
        password: null,
        googleId: payload.googleId,
        emailVerifiedAt: new Date(),
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: role || 'DEVELOPER'
      }
    });

    return this.issueSession(user);
  }

  /**
   * Derives a username candidate from the email local-part, appending a numeric suffix on
   * collision. `AuthService.register` falls back to the *full* email as username
   * (`finalUsername = dto.username || dto.email`) because it has no separate display-name input
   * to derive from there either — here there's no explicit username field at all in the Google
   * profile, so the local-part reads better as a default username than the full email would.
   */
  private async generateUniqueUsername(email: string): Promise<string> {
    const base = email.split('@')[0] || email;
    let candidate = base;
    let suffix = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await this.prisma.user.findUnique({ where: { username: candidate } })) {
      suffix += 1;
      candidate = `${base}${suffix}`;
    }
    return candidate;
  }

  /** Verifies the short-lived ticket from the callback redirect and issues the real 12h access token. */
  async exchangeTicket(ticket: string) {
    let userId: number;
    try {
      const payload = jwt.verify(ticket, this.jwtSecret) as jwt.JwtPayload & { purpose?: string };
      // Security fix (2026-09-14, found in code review): without this, any `{sub}`-shaped JWT
      // signed with the shared secret — a leaked GoogleCalendarService connect `state`, for
      // instance — could be exchanged here for a full 12h session, since only the signature and
      // `sub` were ever checked.
      if (payload.purpose !== 'google-login-ticket') {
        throw new Error('wrong token purpose');
      }
      userId = payload.sub as unknown as number;
    } catch {
      throw new UnauthorizedException('כרטיס ההתחברות פג תוקף או אינו תקין, נסה/י שוב');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.issueSession(user);
  }

  /** Issues the real 12h access token + user shape shared by `register`/`login`. */
  private issueSession(user: { id: number; username: string; email: string; password: string | null }) {
    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, email: user.email },
      this.jwtSecret,
      { expiresIn: '12h' }
    );

    const { password, ...result } = user;
    return { accessToken, user: result };
  }
}
