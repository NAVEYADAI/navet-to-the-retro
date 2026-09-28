import { Injectable } from '@nestjs/common';

// Raw shape of the subset of a Telegram Update object this feature cares about — see
// https://core.telegram.org/bots/api#update / #message.
export interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number | string; type: string };
    text?: string;
  };
}

export interface NormalizedTelegramMessage {
  externalId: string;
  chatType: string;
  text: string | undefined;
  updateId: number;
}

// §10.0 decision #2 — the one piece of code that actually knows about Telegram's raw payload
// shape. Normalizes it into the generic `{externalId, text}` form the channel-agnostic
// `TelegramConversationService` operates on; a future WhatsApp adapter would expose the same
// `normalize`-style output from WhatsApp's own payload shape, without touching the conversation
// service at all.
@Injectable()
export class TelegramAdapterService {
  /** Returns `null` when the update doesn't carry a `message` at all (e.g. `edited_message`, `channel_post`) — ignored. */
  normalize(update: TelegramUpdate): NormalizedTelegramMessage | null {
    const message = update?.message;
    if (!message || !message.chat) return null;

    return {
      externalId: String(message.chat.id),
      chatType: message.chat.type,
      text: typeof message.text === 'string' ? message.text : undefined,
      updateId: update.update_id
    };
  }
}
