import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommentCardNative } from '../comment-card-native';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

// Feature 13 (product-backlog/13-comment-edit-delete.md §13.2) on the native comment card — the twin
// of comment-card-web-edit-delete.test.tsx.
jest.setTimeout(30000);
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

const accent = { fg: '#000', bg: '#111', border: '#222' };
const team = { id: 1, name: 'Core Team', logoUpdatedAt: null };
const comment = (over: Record<string, unknown> = {}) => ({
  id: 7, content: 'הדמו עבר חלק', type: 'KEEP', categoryId: 3, category: { id: 3, label: 'בדיקות' },
  isAnonymous: false, isHighlighted: false, author: { username: 'nave', firstName: 'נוה', lastName: 'ידאי' },
  createdAt: '2026-10-13T10:00:00.000Z', updatedAt: null, isMine: true, canEdit: true, canDelete: true, ...over,
});
const makeActions = (over: Record<string, unknown> = {}) => ({
  editingId: null, deletingId: null, busy: false, error: null,
  startEdit: jest.fn(), cancelEdit: jest.fn(), saveEdit: jest.fn().mockResolvedValue(true),
  askDelete: jest.fn(), cancelDelete: jest.fn(), confirmDelete: jest.fn(), ...over,
}) as any;
const categoryOptions = [{ value: '3', label: 'בדיקות' }, { value: '4', label: 'תכנון' }];

const renderCard = (c: ReturnType<typeof comment>, actions = makeActions()) =>
  render(
    <CommentCardNative
      comment={c} accent={accent} team={team} canHighlight={false} onToggleHighlight={jest.fn()}
      isProposed={false} onPropose={jest.fn()} actions={actions} categoryOptions={categoryOptions}
    />
  );

describe('CommentCardNative — menu', () => {
  it('shows no menu on another member\'s note', async () => {
    const { queryByLabelText } = await renderCard(comment({ isMine: false, canEdit: false, canDelete: false }));
    expect(queryByLabelText(Strings.retroBoard.commentMenuLabel)).toBeNull();
  });

  it('my note: the menu offers edit and delete, each starting its inline flow', async () => {
    const actions = makeActions();
    const c = comment();
    const { getByLabelText, getByText } = await renderCard(c, actions);
    await fireEvent.press(getByLabelText(Strings.retroBoard.commentMenuLabel));
    await fireEvent.press(getByText(Strings.retroBoard.editCommentButton));
    expect(actions.startEdit).toHaveBeenCalledWith(c);

    await fireEvent.press(getByLabelText(Strings.retroBoard.commentMenuLabel));
    await fireEvent.press(getByText(Strings.retroBoard.deleteCommentButton));
    expect(actions.askDelete).toHaveBeenCalledWith(c);
  });

  it('an admin moderating someone else\'s note is offered delete only', async () => {
    const { getByLabelText, getByText, queryByText } = await renderCard(comment({ isMine: false, canEdit: false, canDelete: true }));
    await fireEvent.press(getByLabelText(Strings.retroBoard.commentMenuLabel));
    expect(getByText(Strings.retroBoard.deleteCommentButton)).toBeTruthy();
    expect(queryByText(Strings.retroBoard.editCommentButton)).toBeNull();
  });
});

describe('CommentCardNative — "נערכה" label', () => {
  it('labels an edited note only', async () => {
    const edited = await renderCard(comment({ updatedAt: '2026-10-14T08:00:00.000Z' }));
    expect(edited.getByText(new RegExp(Strings.retroBoard.editedLabel))).toBeTruthy();
    const plain = await renderCard(comment());
    expect(plain.queryByText(new RegExp(Strings.retroBoard.editedLabel))).toBeNull();
  });
});

describe('CommentCardNative — inline edit', () => {
  it('moving the note to the other column sends only the new type', async () => {
    const actions = makeActions({ editingId: 7 });
    const c = comment();
    const { getByText, getAllByText } = await renderCard(c, actions);
    // "שיפור" is the pill in the edit form (the column headers live on the board, not on the card).
    await fireEvent.press(getAllByText(Strings.retroBoard.improveLabel)[0]);
    await fireEvent.press(getByText(Strings.retroBoard.editSaveButton));
    expect(actions.saveEdit).toHaveBeenCalledWith(c, { type: 'IMPROVE' });
  });

  it('changing the category to none sends categoryId null; editing text sends trimmed content', async () => {
    const actions = makeActions({ editingId: 7 });
    const c = comment();
    const { getByText, getByLabelText } = await renderCard(c, actions);
    await fireEvent.press(getByText(Strings.retroBoard.categoryNone));
    await fireEvent.changeText(getByLabelText(Strings.retroBoard.editContentLabel), '  תוכן חדש ');
    await fireEvent.press(getByText(Strings.retroBoard.editSaveButton));
    expect(actions.saveEdit).toHaveBeenCalledWith(c, { content: 'תוכן חדש', categoryId: null });
  });

  it('blank content is rejected locally; cancel leaves the form', async () => {
    const actions = makeActions({ editingId: 7 });
    const { getByText, getByLabelText } = await renderCard(comment(), actions);
    await fireEvent.changeText(getByLabelText(Strings.retroBoard.editContentLabel), '   ');
    await fireEvent.press(getByText(Strings.retroBoard.editSaveButton));
    expect(getByText(Strings.retroBoard.editEmptyError)).toBeTruthy();
    expect(actions.saveEdit).not.toHaveBeenCalled();
    await fireEvent.press(getByText(Strings.retroBoard.editCancelButton));
    expect(actions.cancelEdit).toHaveBeenCalledTimes(1);
  });

  it('anonymous note: says anonymity is fixed; a server error shows on its own card only', async () => {
    const error = { id: 7, message: 'הלוח נעול לכתיבה — הספרינט הסתיים' };
    const own = await renderCard(comment({ isAnonymous: true }), makeActions({ editingId: 7, error }));
    expect(own.getByText(Strings.retroBoard.editAnonymousHint)).toBeTruthy();
    expect(own.getByText(error.message)).toBeTruthy();
    const other = await renderCard(comment({ id: 8 }), makeActions({ editingId: 8, error }));
    expect(other.queryByText(error.message)).toBeNull();
  });
});

describe('CommentCardNative — inline delete confirmation', () => {
  it('confirms or cancels inline', async () => {
    const actions = makeActions({ deletingId: 7 });
    const c = comment();
    const { getByText, queryByText } = await renderCard(c, actions);
    expect(getByText(Strings.retroBoard.deleteConfirmText)).toBeTruthy();
    expect(queryByText(Strings.retroBoard.deleteModerationHint)).toBeNull();
    await fireEvent.press(getByText(Strings.retroBoard.deleteConfirmButton));
    expect(actions.confirmDelete).toHaveBeenCalledWith(c);
    await fireEvent.press(getByText(Strings.retroBoard.deleteCancelButton));
    expect(actions.cancelDelete).toHaveBeenCalledTimes(1);
  });

  it('moderation (someone else\'s note) says so', async () => {
    const { getByText } = await renderCard(comment({ isMine: false, canEdit: false }), makeActions({ deletingId: 7 }));
    expect(getByText(Strings.retroBoard.deleteModerationHint)).toBeTruthy();
  });
});

describe('CommentCardNative — analytics, a11y, limits', () => {
  afterEach(() => (trackEvent as jest.Mock).mockClear());

  it('opening the "⋯" menu is tracked with what the viewer may do (no anonymity flag)', async () => {
    const { getByLabelText } = await renderCard(comment({ isAnonymous: true, canDelete: false }));
    await fireEvent.press(getByLabelText(Strings.retroBoard.commentMenuLabel));
    expect(trackEvent).toHaveBeenCalledWith('comment_menu_opened', { canEdit: true, canDelete: false });
    expect(JSON.stringify((trackEvent as jest.Mock).mock.calls)).not.toMatch(/anonym/i);
  });

  it('every tap on save is tracked (empty / unchanged / changed); column and category changes once each', async () => {
    const { getByText, getByLabelText, getAllByText } = await renderCard(comment(), makeActions({ editingId: 7 }));
    await fireEvent.press(getByText(Strings.retroBoard.editSaveButton));
    expect(trackEvent).toHaveBeenLastCalledWith('comment_edit_save_clicked', { empty: false, changed: false });
    await fireEvent.press(getAllByText(Strings.retroBoard.improveLabel)[0]);
    expect(trackEvent).toHaveBeenCalledWith('comment_edit_column_changed', { type: 'IMPROVE' });
    await fireEvent.press(getByText(Strings.retroBoard.categoryNone));
    expect(trackEvent).toHaveBeenCalledWith('comment_edit_category_changed', { hasCategory: false });
    await fireEvent.changeText(getByLabelText(Strings.retroBoard.editContentLabel), '   ');
    await fireEvent.press(getByText(Strings.retroBoard.editSaveButton));
    expect(trackEvent).toHaveBeenLastCalledWith('comment_edit_save_clicked', { empty: true, changed: false });
  });

  it('the edit input is auto-focused and capped at 2000 characters', async () => {
    const { getByLabelText } = await renderCard(comment(), makeActions({ editingId: 7 }));
    const input = getByLabelText(Strings.retroBoard.editContentLabel);
    expect(input.props.maxLength).toBe(2000);
    expect(input.props.autoFocus).toBe(true);
  });

  it('the highlight star is a labelled button with a 44pt hit area', async () => {
    const onToggle = jest.fn();
    const { getByLabelText, rerender } = await render(
      <CommentCardNative comment={comment()} accent={accent} team={team} canHighlight onToggleHighlight={onToggle}
        isProposed={false} onPropose={jest.fn()} actions={makeActions()} categoryOptions={categoryOptions} />
    );
    const star = getByLabelText(Strings.retroBoard.highlightButton);
    expect(star.props.accessibilityRole).toBe('button');
    expect(star.props.style).toMatchObject({ width: 44, height: 44 });
    await fireEvent.press(star);
    expect(onToggle).toHaveBeenCalledWith(7, true);
    await rerender(
      <CommentCardNative comment={comment({ isHighlighted: true })} accent={accent} team={team} canHighlight onToggleHighlight={onToggle}
        isProposed={false} onPropose={jest.fn()} actions={makeActions()} categoryOptions={categoryOptions} />
    );
    expect(getByLabelText(Strings.retroBoard.unhighlightButton)).toBeTruthy();
  });
});
