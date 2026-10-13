import { isFormerMemberComment } from '../comment-display';

describe('isFormerMemberComment (feature 11)', () => {
  it('is true only for a named comment whose author is no longer an active member', () => {
    expect(isFormerMemberComment({ isAnonymous: false, authorIsActiveMember: false })).toBe(true);
    expect(isFormerMemberComment({ isAnonymous: false, authorIsActiveMember: true })).toBe(false);
    // Older API responses / masked anonymous comments carry no flag — never label them.
    expect(isFormerMemberComment({ isAnonymous: false })).toBe(false);
    expect(isFormerMemberComment({ isAnonymous: true, authorIsActiveMember: false })).toBe(false);
  });
});
