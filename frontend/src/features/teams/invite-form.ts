import { Strings } from '@/constants/strings';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function localDateString(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Client-side validation for the "create invite link" form (BUG-32). Mirrors the backend:
 *  - `expiresAt` is a date-only string (YYYY-MM-DD) that the backend treats as the END of that day,
 *    so picking "today" is valid — it must only not be a day in the past. (The old native check
 *    compared `new Date('2026-10-05')` = 00:00 UTC against now and rejected today.)
 *  - `maxUses`, when given, must be a positive integer (0 / negative used to create a link that
 *    was instantly "exhausted").
 * Returns a Hebrew error message, or null when the inputs are fine.
 */
export function validateInviteInputs(
  { expiresAt, maxUses }: { expiresAt: string; maxUses: string },
  now: Date = new Date(),
): string | null {
  const date = expiresAt.trim();
  if (date) {
    if (!DATE_ONLY.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      return Strings.invites.expiresAtFormatError;
    }
    // Same-format strings compare chronologically; "today" (local) is allowed.
    if (date < localDateString(now)) {
      return Strings.invites.expiresAtPastError;
    }
  }

  const uses = maxUses.trim();
  if (uses) {
    if (!/^\d+$/.test(uses) || Number(uses) < 1) {
      return Strings.invites.maxUsesInvalidError;
    }
  }
  return null;
}
