import { randomUUID } from 'crypto';

/**
 * In-memory "consumed JWT ids" registry used to make short-lived signed tokens (Google Calendar
 * connect `state`, Google-login `ticket` / `pendingTicket`) single-use without a schema change.
 *
 * LIMITATIONS (deliberate, documented — BUG-20 / BUG-21):
 * - Per-process memory: a backend restart forgets consumed ids, and with more than one running
 *   instance a token could be replayed once per instance. Acceptable only because every token
 *   covered here also has a short `exp` (2-10 min), so the replay window is bounded. A fully
 *   reliable fix needs a DB table (jti + consumedAt) — that is a schema change / product call.
 * - It does NOT bind a token to the browser that started the flow (that needs a cookie or
 *   server-side session) — it only prevents the same token from being redeemed twice.
 */
export class SingleUseTokenRegistry {
  private readonly consumed = new Map<string, number>();

  static newId(): string {
    return randomUUID();
  }

  /**
   * Marks `jti` as used. Returns true the first time (token may proceed), false if `jti` is
   * missing or was already consumed. `expSeconds` is the token's own `exp` claim (unix seconds);
   * the entry is kept until then and purged afterwards, so the map cannot grow without bound.
   */
  consume(jti: unknown, expSeconds: unknown, now: number = Date.now()): boolean {
    this.purge(now);
    if (typeof jti !== 'string' || jti.length === 0) {
      return false;
    }
    if (this.consumed.has(jti)) {
      return false;
    }
    const expMs = typeof expSeconds === 'number' ? expSeconds * 1000 : now + 15 * 60 * 1000;
    this.consumed.set(jti, expMs);
    return true;
  }

  private purge(now: number) {
    for (const [id, expMs] of this.consumed) {
      if (expMs <= now) this.consumed.delete(id);
    }
  }
}
