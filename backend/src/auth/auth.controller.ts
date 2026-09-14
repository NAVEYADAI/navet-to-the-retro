import { Controller, Post, Get, Patch, Body, Headers, Query, Res, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginService } from './google-login.service';
import { RegisterDto, LoginDto, UpdateProfileDto, ExchangeGoogleTicketDto, CompleteGoogleRegistrationDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  // Same fallback/convention as EmailService's registration-link building — see
  // backend/src/email/email.service.ts.
  private readonly frontendUrl = process.env.FRONTEND_URL || 'https://navet-to-retro-frontend.fly.dev';

  constructor(
    private readonly authService: AuthService,
    private readonly googleLoginService: GoogleLoginService
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  async me(@Headers('authorization') authHeader: string) {
    return this.authService.validateToken(authHeader);
  }

  @Patch('profile')
  async updateProfile(
    @Headers('authorization') authHeader: string,
    @Body() dto: UpdateProfileDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.authService.updateProfile(user.id, dto);
  }

  // Public (no token) — unlike GET google-calendar/connect, there is no logged-in user yet at
  // this point in the flow (product-backlog/07-google-sign-in.md §7.1). Returns the URL as JSON, same reasoning
  // as GoogleCalendarController.connect: the frontend does the actual top-level navigation
  // itself (`window.location.href = authUrl`).
  @Get('google/connect')
  async googleConnect() {
    const authUrl = this.googleLoginService.getAuthUrl();
    return { authUrl };
  }

  // Hit directly by the user's browser as a redirect from Google — no Authorization header is
  // possible here (mirrors GoogleCalendarController.callback). Never redirects with a real
  // access token in the URL — only a short-lived "ticket" (product-backlog/07-google-sign-in.md §7.0 default #5)
  // or, for a brand-new identity (2026-09-13), a "pendingTicket" that still needs a role picked
  // on the frontend before any account is created — see `GoogleLoginService.handleCallback`.
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response
  ) {
    if (error || !code || !state) {
      res.redirect(`${this.frontendUrl}/auth/google/callback?error=1`);
      return;
    }

    try {
      const result = await this.googleLoginService.handleCallback(code, state);
      const query = 'ticket' in result ? `ticket=${result.ticket}` : `pendingTicket=${result.pendingTicket}`;
      res.redirect(`${this.frontendUrl}/auth/google/callback?${query}`);
    } catch (err) {
      this.logger.error('Google login OAuth callback failed', err instanceof Error ? err.stack : err);
      res.redirect(`${this.frontendUrl}/auth/google/callback?error=1`);
    }
  }

  // Public (no token yet) — verifies the short-lived ticket from the callback redirect and
  // returns the exact same `{accessToken, user}` shape as `register`/`login`, so
  // `auth-context.tsx::login(token, user)` needs no changes.
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  async googleExchange(@Body() dto: ExchangeGoogleTicketDto) {
    return this.googleLoginService.exchangeTicket(dto.ticket);
  }

  // Public (no token yet) — finishes a pending Google signup (handleCallback's "no existing
  // match" branch) with the role chosen on the frontend's role-picker step. Same response shape
  // as `googleExchange`/`register`/`login`.
  @Post('google/complete-registration')
  @HttpCode(HttpStatus.OK)
  async completeGoogleRegistration(@Body() dto: CompleteGoogleRegistrationDto) {
    return this.googleLoginService.completeGoogleRegistration(dto.pendingTicket, dto.role);
  }
}
