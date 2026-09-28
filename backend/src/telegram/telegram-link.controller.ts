import { Controller, Post, Delete, Get, Body, Headers } from '@nestjs/common';
import { TelegramLinkService } from './telegram-link.service';
import { AuthService } from '../auth/auth.service';
import { TelegramLoginPayloadDto } from './dto/telegram.dto';

// Authenticated (manual `AuthService.validateToken`, per backend/AGENTS.md — no Guards) — the
// counterpart to the public `POST /telegram/webhook` in telegram-webhook.controller.ts.
@Controller('auth/telegram')
export class TelegramLinkController {
  constructor(
    private readonly telegramLinkService: TelegramLinkService,
    private readonly authService: AuthService
  ) {}

  @Post('link')
  async link(
    @Headers('authorization') authHeader: string,
    @Body() dto: TelegramLoginPayloadDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.telegramLinkService.link(user.id, dto);
  }

  @Delete('link')
  async unlink(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.telegramLinkService.unlink(user.id);
  }

  @Get('link/status')
  async status(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.telegramLinkService.getStatus(user.id);
  }
}
