import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CommentsModule } from '../comments/comments.module';
import { TeamCategoriesModule } from '../team-categories/team-categories.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramLinkController } from './telegram-link.controller';
import { TelegramApiService } from './telegram-api.service';
import { TelegramAdapterService } from './telegram-adapter.service';
import { TelegramConversationService } from './telegram-conversation.service';
import { TelegramLinkService } from './telegram-link.service';

// §10.0 default #2 — a new module per domain (backend/AGENTS.md), not an extension of
// `comments`/`auth`. Imports `CommentsModule` (to inject the existing `CommentsService.create`,
// §10.0 decision #3 — never a parallel comment-creation path) and `TeamCategoriesModule` (the
// existing `GET /teams/:teamId/categories?enabledOnly=true` logic, reused directly rather than
// duplicated). No existing module imports `TelegramModule` back — no circular dependency.
@Module({
  imports: [AuthModule, CommentsModule, TeamCategoriesModule],
  controllers: [TelegramWebhookController, TelegramLinkController],
  providers: [PrismaService, TelegramApiService, TelegramAdapterService, TelegramConversationService, TelegramLinkService],
  exports: [TelegramConversationService]
})
export class TelegramModule implements OnModuleInit {
  constructor(private readonly telegramApiService: TelegramApiService) {}

  // §10.0 default #10 — registers the webhook (idempotent call, safe on every boot) instead of a
  // manual script/admin-only endpoint; also transparently re-points the webhook whenever the
  // backend's public URL changes (new deploy/domain) with no extra ops step.
  async onModuleInit() {
    await this.telegramApiService.setWebhook();
  }
}
