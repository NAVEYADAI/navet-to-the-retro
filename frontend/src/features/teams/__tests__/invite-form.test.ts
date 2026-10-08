import { validateInviteInputs } from '../invite-form';
import { Strings } from '@/constants/strings';

// Local noon so the local-date string is unambiguous regardless of the machine's timezone.
const now = new Date(2026, 9, 5, 12, 0, 0); // 2026-10-05

describe('validateInviteInputs (BUG-32)', () => {
  it('accepts empty optional fields', () => {
    expect(validateInviteInputs({ expiresAt: '', maxUses: '' }, now)).toBeNull();
  });

  it('accepts "today" as the expiry date (backend treats it as end of that day)', () => {
    expect(validateInviteInputs({ expiresAt: '2026-10-05', maxUses: '' }, now)).toBeNull();
  });

  it('accepts a future date', () => {
    expect(validateInviteInputs({ expiresAt: '2026-10-06', maxUses: '' }, now)).toBeNull();
  });

  it('rejects yesterday and earlier', () => {
    expect(validateInviteInputs({ expiresAt: '2026-10-04', maxUses: '' }, now)).toBe(Strings.invites.expiresAtPastError);
  });

  it('rejects non date-only input', () => {
    expect(validateInviteInputs({ expiresAt: '5/10/2026', maxUses: '' }, now)).toBe(Strings.invites.expiresAtFormatError);
    expect(validateInviteInputs({ expiresAt: '2026-13-45', maxUses: '' }, now)).toBe(Strings.invites.expiresAtFormatError);
  });

  it('requires maxUses to be a positive integer', () => {
    expect(validateInviteInputs({ expiresAt: '', maxUses: '1' }, now)).toBeNull();
    expect(validateInviteInputs({ expiresAt: '', maxUses: '25' }, now)).toBeNull();
    for (const bad of ['0', '-3', '1.5', 'abc', '2e3']) {
      expect(validateInviteInputs({ expiresAt: '', maxUses: bad }, now)).toBe(Strings.invites.maxUsesInvalidError);
    }
  });
});
