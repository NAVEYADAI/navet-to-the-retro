/**
 * @jest-environment jsdom
 *
 * Feature 13 (product-backlog/13-comment-edit-delete.md §13.2) on CommentCardWeb: the "⋯" menu
 * (edit / delete) appears only for what the server allows, the inline edit form sends only what
 * changed, the delete confirmation is inline (never window.confirm), and "נערכה" labels edited notes.
 */
import React, { act } from 'react';
import { CommentCardWeb } from '../comment-card-web';
import { Strings } from '@/constants/strings';
import { AppThemeProvider } from '@/design/theme-context';
import { mountWeb, clickText, setInput, flush, type Mounted } from '@/test-utils/web-dom';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

// jest-expo resolves `.native.tsx` first, which would pull the bottom-sheet menu into this jsdom test — load the web one.
jest.mock('@/components/ui/action-menu', () => jest.requireActual('@/components/ui/action-menu.tsx'));
jest.setTimeout(20000);

let mounted: Mounted | null = null;
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); (trackEvent as jest.Mock).mockClear(); });

const comment = (over: Record<string, unknown> = {}) => ({
  id: 7, content: 'הדמו עבר חלק', type: 'KEEP' as const, categoryId: 3, category: { id: 3, label: 'בדיקות' },
  isAnonymous: false, isHighlighted: false, author: { username: 'nave', firstName: 'נוה', lastName: 'ידאי' },
  createdAt: '2026-10-13T10:00:00.000Z', updatedAt: null, isMine: true, canEdit: true, canDelete: true, ...over,
});

const makeActions = (over: Record<string, unknown> = {}) => ({
  editingId: null, deletingId: null, busy: false, error: null,
  startEdit: jest.fn(), cancelEdit: jest.fn(), saveEdit: jest.fn().mockResolvedValue(true),
  askDelete: jest.fn(), cancelDelete: jest.fn(), confirmDelete: jest.fn(), ...over,
}) as any;

const categoryOptions = [{ value: '3', label: 'בדיקות' }, { value: '4', label: 'תכנון' }];
const mount = (c: ReturnType<typeof comment>, actions = makeActions()) =>
  mountWeb(<AppThemeProvider><CommentCardWeb comment={c} index={0} actions={actions} categoryOptions={categoryOptions} /></AppThemeProvider>);
const menuButton = () => mounted!.container.querySelector<HTMLElement>(`[aria-label="${Strings.retroBoard.commentMenuLabel}"]`);
const openMenu = async () => {
  await act(async () => { menuButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
};
const textarea = () => mounted!.container.querySelector<HTMLTextAreaElement>('textarea:not([aria-hidden="true"])')!;

describe('CommentCardWeb — menu', () => {
  it('shows no menu when the server allows neither edit nor delete (another member\'s note)', async () => {
    mounted = await mount(comment({ isMine: false, canEdit: false, canDelete: false }));
    expect(menuButton()).toBeNull();
  });

  it('shows no menu when no actions are wired (cards outside the board)', async () => {
    mounted = await mountWeb(<AppThemeProvider><CommentCardWeb comment={comment()} index={0} /></AppThemeProvider>);
    expect(menuButton()).toBeNull();
  });

  it('offers edit and delete on my own note, and each opens its inline flow', async () => {
    const actions = makeActions();
    const c = comment();
    mounted = await mount(c, actions);
    await openMenu();
    await clickText(document.body, Strings.retroBoard.editCommentButton);
    expect(actions.startEdit).toHaveBeenCalledWith(c);

    await openMenu();
    await clickText(document.body, Strings.retroBoard.deleteCommentButton);
    expect(actions.askDelete).toHaveBeenCalledWith(c);
  });

  it('an admin moderating someone else\'s note is offered delete only', async () => {
    mounted = await mount(comment({ isMine: false, canEdit: false, canDelete: true }));
    await openMenu();
    expect(document.body.textContent).toContain(Strings.retroBoard.deleteCommentButton);
    expect(document.body.textContent).not.toContain(Strings.retroBoard.editCommentButton);
  });
});

describe('CommentCardWeb — "נערכה" label', () => {
  it('labels a note that was edited, and only that note', async () => {
    mounted = await mount(comment({ updatedAt: '2026-10-14T08:00:00.000Z' }));
    expect(mounted.container.textContent).toContain(Strings.retroBoard.editedLabel);
    await mounted.rerender(<AppThemeProvider><CommentCardWeb comment={comment()} index={0} actions={makeActions()} /></AppThemeProvider>);
    expect(mounted.container.textContent).not.toContain(Strings.retroBoard.editedLabel);
  });
});

describe('CommentCardWeb — inline edit', () => {
  it('shows the form (same textarea field, column switch, category) instead of the note', async () => {
    mounted = await mount(comment(), makeActions({ editingId: 7 }));
    expect(textarea().value).toBe('הדמו עבר חלק');
    expect(mounted.container.textContent).toContain(Strings.retroBoard.editColumnLabel);
    expect(mounted.container.textContent).toContain(Strings.retroBoard.editCategoryLabel);
    expect(menuButton()).toBeNull();
  });

  it('moving the note to the other column sends only the new type', async () => {
    const actions = makeActions({ editingId: 7 });
    const c = comment();
    mounted = await mount(c, actions);
    await clickText(mounted.container, Strings.retroBoard.improveLabel);
    await clickText(mounted.container, Strings.retroBoard.editSaveButton);
    expect(actions.saveEdit).toHaveBeenCalledWith(c, { type: 'IMPROVE' });
  });

  it('editing the text sends only the trimmed content', async () => {
    const actions = makeActions({ editingId: 7 });
    const c = comment();
    mounted = await mount(c, actions);
    await setInput(textarea(), '  הדמו עבר חלק מאוד ');
    await clickText(mounted.container, Strings.retroBoard.editSaveButton);
    expect(actions.saveEdit).toHaveBeenCalledWith(c, { content: 'הדמו עבר חלק מאוד' });
  });

  it('saving with nothing changed sends an empty patch (the hook just closes the form)', async () => {
    const actions = makeActions({ editingId: 7 });
    const c = comment();
    mounted = await mount(c, actions);
    await clickText(mounted.container, Strings.retroBoard.editSaveButton);
    expect(actions.saveEdit).toHaveBeenCalledWith(c, {});
  });

  it('blank content is rejected locally, without a request', async () => {
    const actions = makeActions({ editingId: 7 });
    mounted = await mount(comment(), actions);
    await setInput(textarea(), '   ');
    await clickText(mounted.container, Strings.retroBoard.editSaveButton);
    expect(mounted.container.textContent).toContain(Strings.retroBoard.editEmptyError);
    expect(actions.saveEdit).not.toHaveBeenCalled();
  });

  it('an anonymous note says anonymity cannot be changed; cancel leaves the form', async () => {
    const actions = makeActions({ editingId: 7 });
    mounted = await mount(comment({ isAnonymous: true }), actions);
    expect(mounted.container.textContent).toContain(Strings.retroBoard.editAnonymousHint);
    await clickText(mounted.container, Strings.retroBoard.editCancelButton);
    expect(actions.cancelEdit).toHaveBeenCalledTimes(1);
  });

  it('shows a server error only on the card it belongs to', async () => {
    const error = { id: 7, message: 'הלוח נעול לכתיבה — הספרינט הסתיים' };
    mounted = await mount(comment(), makeActions({ editingId: 7, error }));
    expect(mounted.container.textContent).toContain(error.message);
    await mounted.rerender(<AppThemeProvider><CommentCardWeb comment={comment({ id: 8 })} index={0} actions={makeActions({ editingId: 8, error })} categoryOptions={categoryOptions} /></AppThemeProvider>);
    expect(mounted.container.textContent).not.toContain(error.message);
  });
});

describe('CommentCardWeb — inline delete confirmation', () => {
  it('asks inline (no browser confirm), then confirms or cancels', async () => {
    const confirmSpy = jest.fn();
    (window as any).confirm = confirmSpy;
    const actions = makeActions({ deletingId: 7 });
    const c = comment();
    mounted = await mount(c, actions);
    expect(mounted.container.textContent).toContain(Strings.retroBoard.deleteConfirmText);
    expect(mounted.container.textContent).not.toContain(Strings.retroBoard.deleteModerationHint);

    await clickText(mounted.container, Strings.retroBoard.deleteConfirmButton);
    expect(actions.confirmDelete).toHaveBeenCalledWith(c);
    await clickText(mounted.container, Strings.retroBoard.deleteCancelButton);
    expect(actions.cancelDelete).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('deleting someone else\'s note (moderation) says so', async () => {
    mounted = await mount(comment({ isMine: false, canEdit: false }), makeActions({ deletingId: 7 }));
    expect(mounted.container.textContent).toContain(Strings.retroBoard.deleteModerationHint);
  });
});

describe('CommentCardWeb — analytics', () => {
  it('opening the "⋯" menu is tracked with what the viewer may do (no identity, no anonymity flag)', async () => {
    mounted = await mount(comment({ isAnonymous: true }));
    await openMenu();
    expect(trackEvent).toHaveBeenCalledWith('comment_menu_opened', { canEdit: true, canDelete: true });
    const payloads = JSON.stringify((trackEvent as jest.Mock).mock.calls);
    expect(payloads).not.toMatch(/anonym/i);
  });

  it('every click on save is tracked, including empty text and "nothing changed"', async () => {
    mounted = await mount(comment(), makeActions({ editingId: 7 }));
    await clickText(mounted.container, Strings.retroBoard.editSaveButton);
    expect(trackEvent).toHaveBeenLastCalledWith('comment_edit_save_clicked', { empty: false, changed: false });
    await setInput(textarea(), '   ');
    await clickText(mounted.container, Strings.retroBoard.editSaveButton);
    expect(trackEvent).toHaveBeenLastCalledWith('comment_edit_save_clicked', { empty: true, changed: false });
    await setInput(textarea(), 'משהו אחר');
    await clickText(mounted.container, Strings.retroBoard.editSaveButton);
    expect(trackEvent).toHaveBeenLastCalledWith('comment_edit_save_clicked', { empty: false, changed: true });
  });

  it('switching the column in the edit form is tracked once per change', async () => {
    mounted = await mount(comment(), makeActions({ editingId: 7 }));
    await clickText(mounted.container, Strings.retroBoard.improveLabel);
    expect(trackEvent).toHaveBeenCalledWith('comment_edit_column_changed', { type: 'IMPROVE' });
    await clickText(mounted.container, Strings.retroBoard.improveLabel); // same value again: not a change
    expect((trackEvent as jest.Mock).mock.calls.filter((c) => c[0] === 'comment_edit_column_changed')).toHaveLength(1);
  });
});

describe('CommentCardWeb — keyboard and focus', () => {
  it('the edit textarea is focused when the form opens and stops at the server cap (2000)', async () => {
    mounted = await mount(comment(), makeActions({ editingId: 7 }));
    expect(document.activeElement).toBe(textarea());
    expect(textarea().maxLength).toBe(2000);
  });

  it('Esc inside the edit form cancels it', async () => {
    const actions = makeActions({ editingId: 7 });
    mounted = await mount(comment(), actions);
    await act(async () => { textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(actions.cancelEdit).toHaveBeenCalledTimes(1);
  });

  it('Esc does nothing while a save is in flight', async () => {
    const actions = makeActions({ editingId: 7, busy: true });
    mounted = await mount(comment(), actions);
    await act(async () => { textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(actions.cancelEdit).not.toHaveBeenCalled();
  });

  it('when the edit form closes, focus goes back to the card\'s "⋯" button', async () => {
    const c = comment();
    mounted = await mount(c, makeActions({ editingId: 7 }));
    expect(menuButton()).toBeNull(); // hidden while editing
    await mounted.rerender(<AppThemeProvider><CommentCardWeb comment={c} index={0} actions={makeActions()} categoryOptions={categoryOptions} /></AppThemeProvider>);
    expect(document.activeElement).toBe(menuButton());
  });

  it('delete confirmation: a labelled live group (not an alertdialog), confirm button focused, Esc cancels, focus returns on close', async () => {
    const actions = makeActions({ deletingId: 7 });
    const c = comment();
    mounted = await mount(c, actions);
    expect(mounted.container.querySelector('[role="alertdialog"]')).toBeNull();
    const group = mounted.container.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-live')).toBe('polite');
    expect(group.getAttribute('aria-label')).toBe(Strings.retroBoard.deleteConfirmText);
    expect(document.activeElement?.textContent).toBe(Strings.retroBoard.deleteConfirmButton);

    await act(async () => { (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(actions.cancelDelete).toHaveBeenCalledTimes(1);

    await mounted.rerender(<AppThemeProvider><CommentCardWeb comment={c} index={0} actions={makeActions()} categoryOptions={categoryOptions} /></AppThemeProvider>);
    expect(document.activeElement).toBe(menuButton());
  });
});
