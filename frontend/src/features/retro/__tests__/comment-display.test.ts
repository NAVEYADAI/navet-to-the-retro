import { getCommentCategoryLabel, getCommentAuthorName } from '../comment-display';
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
