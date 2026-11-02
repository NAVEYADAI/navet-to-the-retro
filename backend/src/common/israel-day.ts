import { ISRAEL_TIME_ZONE } from './validation';

/**
 * BUG-24: sprint `startDate`/`endDate` are stored as midnight UTC of the calendar day the user
 * picked (the frontend shows a sprint as active for that whole local day). Comparing the raw
 * instants against `now` made the last day "closed" from 00:00 UTC (03:00 Israel time). Instead,
 * resolve "today" as a calendar date in Asia/Jerusalem and return it as midnight UTC of that date,
 * so `startDate <= anchor <= endDate` treats the whole first and last Israeli day as open.
 *
 * The single implementation, shared by the write window (sprints/sprint-write-window.util.ts) and
 * the Telegram bot (telegram/telegram-conversation.service.ts). It lives in `common/` and imports
 * only `common/validation`, so neither side depends on the other.
 */
export function israelDayAnchor(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00.000Z`);
}
