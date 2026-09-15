import { getCommentCategoryLabel, getCommentAuthorName, getPostedByAdminLabel } from '../comment-display';
import { Strings } from '@/constants/strings';

describe('getCommentCategoryLabel', () => {
  it('returns null when there is no category', () => {
    expect(getCommentCategoryLabel({ category: null })).toBeNull();
    expect(getCommentCategoryLabel({ category: undefined })).toBeNull();
  });

  it('maps a known category key to its Hebrew label', () => {
    expect(getCommentCategoryLabel({ category: 'TESTING' })).toBe(Strings.retroBoard.categories.TESTING);
  });

  it('returns null for a category key not present in the strings map', () => {
    expect(getCommentCategoryLabel({ category: 'NOT_A_REAL_CATEGORY' })).toBeNull();
  });
});

describe('getCommentAuthorName', () => {
  const author = { username: 'dev1', firstName: 'Dana', lastName: 'Levi' };

  it('returns the anonymous label when isAnonymous is true, regardless of the real name', () => {
    expect(getCommentAuthorName({ isAnonymous: true, author })).toBe(Strings.retroBoard.anonymousAuthor);
  });

  it('joins first and last name when both are present', () => {
    expect(getCommentAuthorName({ isAnonymous: false, author })).toBe('Dana Levi');
  });

  it('falls back to just the first name when there is no last name', () => {
    expect(getCommentAuthorName({ isAnonymous: false, author: { username: 'dev1', firstName: 'Dana', lastName: null } }))
      .toBe('Dana');
  });

  it('falls back to just the last name when there is no first name', () => {
    expect(getCommentAuthorName({ isAnonymous: false, author: { username: 'dev1', firstName: null, lastName: 'Levi' } }))
      .toBe('Levi');
  });

  it('falls back to the username when neither first nor last name is present', () => {
    expect(getCommentAuthorName({ isAnonymous: false, author: { username: 'dev1', firstName: null, lastName: null } }))
      .toBe('dev1');
  });
});

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decisions #2/#3): the
// "posted on behalf of" indicator — always visible when present (never masked like isAnonymous),
// and always names the specific admin/team-leader who posted it.
describe('getPostedByAdminLabel', () => {
  const author = { username: 'phantom_abc', firstName: 'Phanto', lastName: 'Mm' };
  const admin = { id: 20, username: 'adminuser', firstName: 'Admin', lastName: 'Istrator' };

  it('returns null when the comment was not posted on behalf of anyone', () => {
    expect(getPostedByAdminLabel({ isAnonymous: false, author, postedByAdmin: null })).toBeNull();
    expect(getPostedByAdminLabel({ isAnonymous: false, author, postedByAdmin: undefined })).toBeNull();
  });

  it('names both the author and the specific admin who posted it', () => {
    expect(getPostedByAdminLabel({ isAnonymous: false, author, postedByAdmin: admin }))
      .toBe(Strings.retroBoard.postedOnBehalfIndicator('Phanto Mm', 'Admin Istrator'));
  });

  it('falls back to usernames when either side has no first/last name', () => {
    expect(getPostedByAdminLabel({
      isAnonymous: false,
      author: { username: 'phantom_abc', firstName: null, lastName: null },
      postedByAdmin: { id: 20, username: 'adminuser', firstName: null, lastName: null },
    })).toBe(Strings.retroBoard.postedOnBehalfIndicator('phantom_abc', 'adminuser'));
  });

  it('is never masked by isAnonymous — §9.0 decision #2: "on behalf of" comments can\'t be anonymous, but the label logic itself does not special-case it either', () => {
    expect(getPostedByAdminLabel({ isAnonymous: true, author, postedByAdmin: admin }))
      .toBe(Strings.retroBoard.postedOnBehalfIndicator(Strings.retroBoard.anonymousAuthor, 'Admin Istrator'));
  });

  it('names a different admin per-comment (postedByAdminId is per-comment, §9.0 decision #3)', () => {
    const secondAdmin = { id: 21, username: 'leader2', firstName: 'Leora', lastName: 'Cohen' };
    expect(getPostedByAdminLabel({ isAnonymous: false, author, postedByAdmin: secondAdmin }))
      .toBe(Strings.retroBoard.postedOnBehalfIndicator('Phanto Mm', 'Leora Cohen'));
  });
});
