import { Controller, Get, Patch, Query, Headers, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleCalendarService } from './google-calendar.service';
import { AuthService } from '../auth/auth.service';

@Controller('google-calendar')
export class GoogleCalendarController {
  private readonly logger = new Logger(GoogleCalendarController.name);
  // Same fallback/convention as EmailService's registration-link building — see
  // backend/src/email/email.service.ts.
  private readonly frontendUrl = process.env.FRONTEND_URL || 'https://navet-to-retro-frontend.fly.dev';

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly authService: AuthService
  ) {}

  // Returns the Google consent-screen URL as JSON rather than issuing a 302 itself — this is an
  // authenticated endpoint (manual validateToken, per backend/AGENTS.md), and a plain browser
  // navigation triggered by clicking a button can't carry an Authorization header. The frontend
  // calls this with the user's token, then does the actual top-level navigation itself
  // (`window.location.href = authUrl`).
  @Get('connect')
  async connect(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    const authUrl = this.googleCalendarService.getAuthUrl(user.id, user.email);
    return { authUrl };
  }

  @Get('status')
  async status(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.googleCalendarService.getStatus(user.id);
  }

  // Hit directly by the user's browser as a redirect from Google — no Authorization header is
  // possible here. `state` (signed in `connect`) is what identifies which user this belongs to.
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response
  ) {
    if (error || !code || !state) {
      res.redirect(`${this.frontendUrl}/settings?googleCalendar=error`);
      return;
    }

    try {
      await this.googleCalendarService.handleCallback(code, state);
      res.redirect(`${this.frontendUrl}/settings?googleCalendar=connected`);
    } catch (err) {
      this.logger.error('Google Calendar OAuth callback failed', err instanceof Error ? err.stack : err);
      res.redirect(`${this.frontendUrl}/settings?googleCalendar=error`);
    }
  }

  @Patch('disconnect')
  async disconnect(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.googleCalendarService.disconnect(user.id);
  }
}
