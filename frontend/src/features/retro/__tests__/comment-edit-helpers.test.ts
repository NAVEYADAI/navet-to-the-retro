import { isCommentEdited, editCategoryOptions } from '../comment-display';
import { extensionMemberOptions } from '../write-extension-members';

describe('isCommentEdited (feature 13)', () => {
  it('is true only when the server stamped updatedAt', () => {
    expect(isCommentEdited({ updatedAt: '2026-10-14T08:00:00.000Z' })).toBe(true);
    expect(isCommentEdited({ updatedAt: null })).toBe(false);
    expect(isCommentEdited({})).toBe(false);
  });
});

describe('editCategoryOptions (feature 13)', () => {
  const teamCategories = [
    { id: 1, label: 'כללי', isEnabled: true },
    { id: 2, label: 'ישנה', isEnabled: false },
  ];

  it('offers enabled categories only', () => {
    expect(editCategoryOptions(teamCategories, null)).toEqual([{ value: '1', label: 'כללי' }]);
  });

  it('keeps the comment\'s own category even if it was disabled since', () => {
    expect(editCategoryOptions(teamCategories, { id: 2, label: 'ישנה' })).toEqual([{ value: '1', label: 'כללי' }, { value: '2', label: 'ישנה' }]);
  });

  it('keeps the comment\'s own category even if the team list does not include it', () => {
    expect(editCategoryOptions([], { id: 9, label: 'נמחקה' })).toEqual([{ value: '9', label: 'נמחקה' }]);
  });
});

describe('extensionMemberOptions (feature 13)', () => {
  it('lists real active members, the admin themself included; skips phantoms and pending invitations', () => {
    const members = [
      { userId: 1, status: 'ACTIVE', user: { username: 'admin', firstName: 'נוה', lastName: '' } },
      { userId: 2, status: 'ACTIVE', user: { username: 'dana', firstName: 'דנה', lastName: 'כהן' } },
      { userId: 3, status: 'ACTIVE', user: { username: 'ghost', isPhantom: true } },
      { userId: 4, status: 'PENDING', user: { username: 'wait' } },
    ];
    expect(extensionMemberOptions(members)).toEqual([{ value: '1', label: 'נוה' }, { value: '2', label: 'דנה כהן' }]);
  });

  it('copes with a team that has no members loaded', () => {
    expect(extensionMemberOptions(undefined)).toEqual([]);
  });
});
