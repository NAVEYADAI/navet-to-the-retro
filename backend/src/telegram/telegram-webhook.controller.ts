import { Controller, Post, Body, Headers, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { TelegramAdapterService } from './telegram-adapter.service';
import type { TelegramUpdate } from './telegram-adapter.service';
import { TelegramConversationService } from './telegram-conversation.service';
import { TelegramApiService } from './telegram-api.service';
import { GROUP_CHAT_NOT_SUPPORTED_MESSAGE, NOT_LINKED_MESSAGE, TEXT_ONLY_MESSAGE } from './telegram-messages';

// Public endpoint (no `AuthService.validateToken` — no JWT concept here at all) authenticated
// instead by Telegram's own `secret_token` mechanism (§10.0 decision #10): the secret configured
// on `setWebhook` (see TelegramApiService) is echoed back on every incoming update in the
// `X-Telegram-Bot-Api-Secret-Token` header, verified here before anything else runs.
@Controller('telegram')
export class TelegramWebhookController {
  private readonly webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  constructor(
    private readonly adapterService: TelegramAdapterService,
    private readonly conversationService: TelegramConversationService,
    private readonly telegramApi: TelegramApiService
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') secretToken: string | undefined,
    @Body() update: TelegramUpdate
  ) {
    if (!this.webhookSecret || !secretToken || secretToken !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret token');
    }

    const normalized = this.adapterService.normalize(update);
    if (!normalized) {
      return { ok: true }; // not a message-type update (e.g. edited_message, channel_post) — ignore
    }

    const { externalId, chatType, text, updateId } = normalized;

    // §10.0 default #11 — group/channel chats don't fit the one-identity-one-active-context model.
    if (chatType !== 'private') {
      await this.telegramApi.sendMessage(externalId, GROUP_CHAT_NOT_SUPPORTED_MESSAGE);
      return { ok: true };
    }

    const link = await this.conversationService.findActiveLink('TELEGRAM', externalId);
    if (!link) {
      await this.telegramApi.sendMessage(externalId, NOT_LINKED_MESSAGE);
      return { ok: true };
    }

    // §10.0 default #9 — idempotency check happens right after resolving the link; a duplicate
    // (Telegram retry, notably after a Fly suspend/resume) is a silent no-op, never a second reply.
    if (this.conversationService.isDuplicateUpdate(link, updateId)) {
      return { ok: true };
    }

    // §10.0 default #12 — only `message.text` is supported; every other message type gets a short
    // reply instead of being processed, but still counts as "processed" for idempotency purposes.
    if (text === undefined) {
      await this.telegramApi.sendMessage(externalId, TEXT_ONLY_MESSAGE);
      await this.conversationService.markProcessed(link.id, updateId);
      return { ok: true };
    }

    await this.conversationService.handleTextMessage(link, text, updateId);
    return { ok: true };
  }
}
