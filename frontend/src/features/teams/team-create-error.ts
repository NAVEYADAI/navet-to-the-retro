import { Strings } from '@/constants/strings';

const HEBREW = /[֐-׿]/;

/**
 * Friendly Hebrew message for a failed "create team" request (BUG-56). Server messages for this
 * endpoint are already Hebrew (e.g. "not an allowed approver") and are shown as-is; anything else —
 * raw axios text like "Request failed with status code 403", an English/validation message, an
 * array of class-validator messages — is replaced by a generic Hebrew one.
 */
export function getTeamCreateErrorMessage(err: any): string {
  if (err && !err.response) {
    return Strings.dashboard.teamCreateNetworkError;
  }
  const raw = err?.response?.data?.message;
  const message = Array.isArray(raw) ? raw.find((m) => typeof m === 'string' && HEBREW.test(m)) : raw;
  if (typeof message === 'string' && HEBREW.test(message)) {
    return message;
  }
  return Strings.dashboard.teamCreateFailedError;
}
