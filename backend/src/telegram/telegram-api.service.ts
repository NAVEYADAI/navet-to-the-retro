import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// A plain Telegram reply keyboard (tap-to-send buttons shown under the message input) — NOT an
// inline keyboard/callback_query (§10.0 default #3 deliberately avoided that: this stays a plain
// text message under the hood, just with tappable buttons, so the existing text-matching state
// machine in TelegramConversationService needs no changes to *handle* a reply).
export interface TelegramReplyKeyboard {
  keyboard: string[][];
  resize_keyboard: true;
  one_time_keyboard: true;
}

// Thin wrapper around plain HTTP calls to the Telegram Bot API — deliberately NOT a full bot
// framework (`node-telegram-bot-api`/`telegraf`), per product-backlog/10-telegram-comment-
// ingestion.md §10.0 default #3: consistent with this backend's existing "manual, no extra
// framework" style (backend/AGENTS.md: "manual JWT... no Guards, no Passport").
@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;

  isConfigured(): boolean {
    return Boolean(this.botToken);
  }

  private baseUrl(): string {
    return `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Sends a plain text message to a chat, optionally with a reply keyboard (tap-to-select
   * buttons). Best-effort — a Telegram API outage/error must never throw back into the webhook
   * handler (mirrors GoogleCalendarService's "never block on the external service" philosophy),
   * it's just logged.
   */
  async sendMessage(chatId: string, text: string, replyMarkup?: TelegramReplyKeyboard): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — skipping sendMessage');
      return;
    }
    try {
      await axios.post(`${this.baseUrl()}/sendMessage`, {
        chat_id: chatId,
        text,
        // Legacy Markdown (not MarkdownV2) — supports *bold*/_italic_ with far fewer characters
        // needing escaping, which matters because message text interpolates user-entered team/
        // sprint/category names (see escapeMarkdown() in telegram-messages.ts).
        parse_mode: 'Markdown',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {})
      });
    } catch (err) {
      this.logger.warn(`Failed to send Telegram message to chat ${chatId}`, err instanceof Error ? err.stack : err);
    }
  }

  /**
   * Registers (or re-registers, idempotently — safe to call on every boot) the webhook URL +
   * secret_token with Telegram. Called from TelegramModule::onModuleInit, not a manual script/
   * admin endpoint (§10.0 default #10) — this also transparently re-points the webhook whenever
   * the backend's public URL changes (new deploy/domain) without any extra ops step.
   */
  async setWebhook(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — skipping setWebhook');
      return;
    }
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secretToken) {
      this.logger.warn('TELEGRAM_WEBHOOK_SECRET not set — skipping setWebhook');
      return;
    }
    const backendUrl = process.env.BACKEND_URL || 'https://navet-to-retro-backend.fly.dev';
    const url = `${backendUrl}/telegram/webhook`;
    try {
      await axios.post(`${this.baseUrl()}/setWebhook`, { url, secret_token: secretToken });
    } catch (err) {
      this.logger.warn('Failed to register Telegram webhook', err instanceof Error ? err.stack : err);
    }
  }
}
