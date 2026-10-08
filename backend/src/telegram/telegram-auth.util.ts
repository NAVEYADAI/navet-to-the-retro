import * as crypto from 'crypto';

// Raw payload shape returned by the Telegram Login Widget's `data-onauth` callback — see
// https://core.telegram.org/widgets/login. `hash` is verified separately (see below), never
// trusted as-is.
export interface TelegramLoginPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// BUG-50: was 24h. `auth_date` is the unix time at which Telegram signed the payload, i.e. the
// moment the user tapped "log in" in the widget; the widget hands the payload straight to our
// `data-onauth` callback, which POSTs it immediately — so a few minutes is plenty. A shorter window
// shrinks the replay window of a leaked payload. (True one-time use would need to persist a used
// hash/auth_date server-side, i.e. a schema change — intentionally not done here.)
const MAX_AUTH_AGE_MS = 5 * 60 * 1000;
// Small tolerance for clock skew between Telegram's servers and ours; anything dated further in the
// future than this is not a genuine payload.
const MAX_CLOCK_SKEW_MS = 60 * 1000;

/**
 * Verifies a Telegram Login Widget payload's `hash` per Telegram's official spec
 * (https://core.telegram.org/widgets/login#checking-authorization): the data-check-string is
 * every field except `hash`, sorted by key, joined as `key=value` with `\n`; the secret key is
 * `SHA256(bot_token)`; the expected hash is `HMAC-SHA256(data_check_string, secret_key)` in hex.
 * Not a made-up scheme — product-backlog/10-telegram-comment-ingestion.md §10.0 default #4 calls
 * this out explicitly as the one piece of real new technical research this feature needed.
 */
export function verifyTelegramLoginHash(payload: TelegramLoginPayload, botToken: string): boolean {
  const { hash, ...rest } = payload;
  if (!hash) return false;

  const dataCheckString = Object.keys(rest)
    .filter((key) => (rest as Record<string, unknown>)[key] !== undefined && (rest as Record<string, unknown>)[key] !== null)
    .sort()
    .map((key) => `${key}=${(rest as Record<string, unknown>)[key]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Constant-time-ish compare via crypto.timingSafeEqual — both buffers must be equal length,
  // guarded first since a length mismatch would otherwise throw instead of returning false.
  const computedBuffer = Buffer.from(computedHash, 'hex');
  const providedBuffer = Buffer.from(hash, 'hex');
  if (computedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(computedBuffer, providedBuffer);
}

/** True when `auth_date` (unix seconds) is recent (≤ 5 min old) and not meaningfully in the future. */
export function isTelegramAuthDateFresh(authDateSeconds: number, now: Date = new Date()): boolean {
  if (typeof authDateSeconds !== 'number' || !Number.isFinite(authDateSeconds)) return false;
  const ageMs = now.getTime() - authDateSeconds * 1000;
  return ageMs <= MAX_AUTH_AGE_MS && ageMs >= -MAX_CLOCK_SKEW_MS;
}
