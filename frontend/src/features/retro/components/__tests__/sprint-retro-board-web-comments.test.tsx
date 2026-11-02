/**
 * @jest-environment jsdom
 *
 * Feature 13 (product-backlog/13-comment-edit-delete.md §13.2) on the full web board: locked board,
 * "פתוח לך עד …", who gets the "⋯" menu, the edit and delete flows end to end (against a mocked API),
 * and the two admin-only panels.
 */
import React, { act } from 'react';
import axios from 'axios';
import { SprintRetroBoardWeb } from '../sprint-retro-board-web';
import { Strings } from '@/constants/strings';
import { formatDate } from '@/lib/format-date';
import { trackEvent } from '@/lib/analytics';
import { mountWeb, clickText, setInput, flush, type Mounted } from '@/test-utils/web-dom';

jest.mock('@/components/ui/action-menu', () => jest.requireActual('@/components/ui/action-menu.tsx'));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
// jest-expo resolves the native Icon; a stub that exposes the icon name lets the tests tell lock from eye-off.
jest.mock('@/components/ui/icon', () => ({ Icon: ({ name }: { name: string }) => require('react').createElement('span', { 'data-icon': name }) }));
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.setTimeout(30000);

const sprint = { id: 5, name: 'Sprint 5', description: '', startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-15T00:00:00.000Z' };
const member = (userId: number, over: Record<string, unknown> = {}) => ({
  userId, isAdmin: false, role: 'MEMBER', status: 'ACTIVE', user: { id: userId, username: `u${userId}`, firstName: `שם${userId}`, lastName: '' }, ...over,
});
const teamOf = (me: Record<string, unknown>) => ({ id: 1, name: 'Core Team', creatorId: 99, members: [me, member(21), member(22)] });
const admin = { id: 1, username: 'admin' };
const mine = {
  id: 1, type: 'KEEP', content: 'הערה שלי', isAnonymous: false, categoryId: null, category: null, author: { username: 'admin' },
  createdAt: '2026-08-04T12:00:00.000Z', updatedAt: null, isMine: true, canEdit: true, canDelete: true,
};
const theirs = { ...mine, id: 2, type: 'IMPROVE', content: 'הערה של אחר', author: { username: 'dev' }, isMine: false, canEdit: false, canDelete: false };

let mounted: Mounted | null = null;
let comments: any[];
let access: any;
let deleted: any[];

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  comments = [mine, theirs];
  access = { canWrite: true, windowOpen: true, windowDays: 3, extensionExpiresAt: null };
  deleted = [];
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.includes('/comments/deleted')) return Promise.resolve({ data: deleted });
    if (url.includes('/comments')) return Promise.resolve({ data: comments });
    if (url.includes('/write-access')) return Promise.resolve({ data: access });
    return Promise.resolve({ data: [] }); // categories, length-history, write-extensions, focus points
  });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockedAxios.get.mockReset(); mockedAxios.patch.mockReset(); mockedAxios.delete.mockReset(); mockedAxios.post.mockReset();
});

const render = async (me: Record<string, unknown> = member(1, { isAdmin: true, role: 'TEAM_LEADER' }), user = admin) => {
  mounted = await mountWeb(
    <SprintRetroBoardWeb sprint={sprint} team={teamOf(me)} token="tok" user={user} onBack={jest.fn()} onOpenSummary={jest.fn()} onOpenMemory={jest.fn()} />
  );
  return mounted.container;
};
const menuButtons = (c: HTMLElement) => c.querySelectorAll(`[aria-label="${Strings.retroBoard.commentMenuLabel}"]`);
const openCardMenu = async (c: HTMLElement, index = 0) => {
  await act(async () => { (menuButtons(c)[index] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
};
const composeButton = (c: HTMLElement) => Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes(Strings.retroBoard.postNoteButton));

describe('SprintRetroBoardWeb — write window (feature 13)', () => {
  it('open window: the compose form is there and there is no notice', async () => {
    const c = await render();
    expect(composeButton(c)).toBeTruthy();
    expect(c.querySelector('[data-testid="write-locked-notice"]')).toBeNull();
    expect(c.querySelector('[data-testid="write-extension-notice"]')).toBeNull();
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-access'), expect.anything());
  });

  it('a locked board shows "הלוח נעול לכתיבה" instead of the compose form', async () => {
    access = { canWrite: false, windowOpen: false, windowDays: 3, extensionExpiresAt: null };
    const c = await render();
    expect(c.querySelector('[data-testid="write-locked-notice"]')?.textContent).toContain(Strings.retroBoard.writeLockedTitle);
    expect(composeButton(c)).toBeUndefined();
    // The notes are still readable.
    expect(c.textContent).toContain('הערה שלי');
  });

  it('with an admin extension the form is back, with "פתוח לך עד <תאריך>"', async () => {
    const until = '2026-10-30T20:59:59.999Z';
    access = { canWrite: true, windowOpen: false, windowDays: 3, extensionExpiresAt: until };
    const c = await render();
    expect(c.querySelector('[data-testid="write-extension-notice"]')?.textContent).toContain(Strings.retroBoard.writeOpenUntil(formatDate(until)));
    expect(composeButton(c)).toBeTruthy();
    expect(c.querySelector('[data-testid="write-locked-notice"]')).toBeNull();
  });

  it('the explicit refresh re-reads the write access (no refetch on its own)', async () => {
    const c = await render();
    const writeAccessCalls = () => mockedAxios.get.mock.calls.filter(([url]) => String(url).includes('/write-access')).length;
    expect(writeAccessCalls()).toBe(1);
    await clickText(c, Strings.common.refreshButton);
    expect(writeAccessCalls()).toBe(2);
  });
});

describe('SprintRetroBoardWeb — write form gating and anonymity (feature 13 review fixes)', () => {
  const composeTextarea = (c: HTMLElement) => c.querySelector<HTMLTextAreaElement>('textarea:not([aria-hidden="true"])')!;
  const post = async (c: HTMLElement) => {
    await setInput(composeTextarea(c), 'תוכן חדש');
    await clickText(c, Strings.retroBoard.postNoteButton);
  };

  it('does not flash the compose form before the first write-access response; a locked answer never shows it', async () => {
    let resolveAccess!: (v: any) => void;
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/write-access')) return new Promise((r) => { resolveAccess = r; });
      if (url.includes('/comments/deleted')) return Promise.resolve({ data: [] });
      if (url.includes('/comments')) return Promise.resolve({ data: comments });
      return Promise.resolve({ data: [] });
    });
    const c = await render();
    expect(composeButton(c)).toBeUndefined();
    expect(c.querySelector('textarea')).toBeNull();
    await act(async () => { resolveAccess({ data: { canWrite: false, windowOpen: false, windowDays: 3, extensionExpiresAt: null } }); });
    await flush();
    expect(composeButton(c)).toBeUndefined();
    expect(c.querySelector('[data-testid="write-locked-notice"]')).not.toBeNull();
  });

  it('a failed write-access call is fail-open: the form shows once the call settles', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/write-access')) return Promise.reject(new Error('Network Error'));
      if (url.includes('/comments/deleted')) return Promise.resolve({ data: [] });
      if (url.includes('/comments')) return Promise.resolve({ data: comments });
      return Promise.resolve({ data: [] });
    });
    const c = await render();
    expect(composeButton(c)).toBeTruthy();
  });

  it('the locked notice uses the lock icon, not the eye-off one', async () => {
    access = { canWrite: false, windowOpen: false, windowDays: 3, extensionExpiresAt: null };
    const c = await render();
    const notice = c.querySelector('[data-testid="write-locked-notice"]')!;
    expect(notice.querySelector('[data-icon="lock"]')).not.toBeNull();
    expect(notice.querySelector('[data-icon="eye-off"]')).toBeNull();
  });

  it('the write textarea stops at the server cap (2000 characters)', async () => {
    const c = await render();
    expect(composeTextarea(c).maxLength).toBe(2000);
  });

  it('anonymous allowed: the option is offered and the note is sent anonymous', async () => {
    access = { ...access, anonymousAllowed: true };
    mockedAxios.post.mockResolvedValue({ data: {} });
    const c = await render();
    expect(c.textContent).toContain(Strings.retroBoard.anonymousToggleLabel);
    expect(c.querySelector('[data-testid="anonymous-locked-hint"]')).toBeNull();
    await clickText(c, Strings.retroBoard.anonymousToggleLabel);
    await post(c);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/comments'), expect.objectContaining({ isAnonymous: true }), expect.anything());
  });

  it('anonymous NOT allowed (locked board kept open by an extension): no anonymous option, an explanation, and isAnonymous is false', async () => {
    access = { canWrite: true, windowOpen: false, windowDays: 3, extensionExpiresAt: '2026-10-30T20:59:59.999Z', anonymousAllowed: false };
    mockedAxios.post.mockResolvedValue({ data: {} });
    const c = await render();
    const labels = Array.from(c.querySelectorAll('*')).map((el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim());
    expect(labels).not.toContain(Strings.retroBoard.anonymousToggleLabel);
    expect(labels).toContain(Strings.retroBoard.identifiedToggleLabel);
    expect(c.querySelector('[data-testid="anonymous-locked-hint"]')?.textContent).toBe(Strings.retroBoard.anonymousLockedHint);
    await post(c);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/comments'), expect.objectContaining({ isAnonymous: false }), expect.anything());
  });

  it('a refresh that turns anonymity off drops a pending "anonymous" choice', async () => {
    access = { ...access, anonymousAllowed: true };
    mockedAxios.post.mockResolvedValue({ data: {} });
    const c = await render();
    await clickText(c, Strings.retroBoard.anonymousToggleLabel);
    access = { canWrite: true, windowOpen: false, windowDays: 3, extensionExpiresAt: '2026-10-30T20:59:59.999Z', anonymousAllowed: false };
    await clickText(c, Strings.common.refreshButton);
    await post(c);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ isAnonymous: false }), expect.anything());
  });
});

describe('SprintRetroBoardWeb — edit and delete (feature 13)', () => {
  it('only notes the server marked as editable/deletable get the menu', async () => {
    const c = await render(member(1), admin);
    expect(menuButtons(c)).toHaveLength(1);
  });

  it('editing: move to the other column and fix the text — one PATCH, the note moves and is labelled "נערכה"', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { ...mine, type: 'IMPROVE', content: 'הערה מתוקנת', updatedAt: '2026-08-05T09:00:00.000Z' } });
    const c = await render(member(1));
    await openCardMenu(c);
    await clickText(document.body, Strings.retroBoard.editCommentButton);
    const textarea = c.querySelector<HTMLTextAreaElement>('textarea:not([aria-hidden="true"]):not([placeholder])')
      ?? Array.from(c.querySelectorAll<HTMLTextAreaElement>('textarea:not([aria-hidden="true"])')).find((t) => t.value === 'הערה שלי')!;
    await setInput(textarea, 'הערה מתוקנת');
    // the column switch of the edit form: the segment next to the "עמודה" label
    const columnLabel = Array.from(c.querySelectorAll<HTMLElement>('p')).find((p) => p.textContent === Strings.retroBoard.editColumnLabel)!;
    await clickText(columnLabel.parentElement!, Strings.retroBoard.improveLabel);
    await clickText(c, Strings.retroBoard.editSaveButton);

    expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/comments/1'), { content: 'הערה מתוקנת', type: 'IMPROVE' }, { headers: { Authorization: 'Bearer tok' } });
    expect(c.textContent).toContain('הערה מתוקנת');
    expect(c.textContent).not.toContain('הערה שלי');
    expect(c.textContent).toContain(Strings.retroBoard.editedLabel);
    // the form is gone, the menu is back; no extra GET of the comments (the board patched its own list)
    expect(menuButtons(c)).toHaveLength(1);
    expect(mockedAxios.get.mock.calls.filter(([url]) => /\/sprints\/5\/comments$/.test(String(url)))).toHaveLength(1);
  });

  it('a rejected edit (board locked meanwhile) keeps the form open and shows the server message', async () => {
    mockedAxios.patch.mockRejectedValue(Object.assign(new Error('403'), { response: { data: { message: 'הלוח נעול לכתיבה — הספרינט הסתיים' } } }));
    const c = await render(member(1));
    await openCardMenu(c);
    await clickText(document.body, Strings.retroBoard.editCommentButton);
    const textarea = Array.from(c.querySelectorAll<HTMLTextAreaElement>('textarea:not([aria-hidden="true"])')).find((t) => t.value === 'הערה שלי')!;
    await setInput(textarea, 'שינוי');
    await clickText(c, Strings.retroBoard.editSaveButton);
    expect(c.textContent).toContain('הלוח נעול לכתיבה — הספרינט הסתיים');
    expect(Array.from(c.querySelectorAll<HTMLTextAreaElement>('textarea')).some((t) => t.value === 'שינוי')).toBe(true);
  });

  it('deleting: an inline confirmation first, then one DELETE and the note disappears', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { id: 1 } });
    const c = await render(member(1));
    await openCardMenu(c);
    await clickText(document.body, Strings.retroBoard.deleteCommentButton);
    expect(c.textContent).toContain(Strings.retroBoard.deleteConfirmText);
    expect(mockedAxios.delete).not.toHaveBeenCalled();

    await clickText(c, Strings.retroBoard.deleteConfirmButton);
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/comments/1'), { headers: { Authorization: 'Bearer tok' } });
    expect(c.textContent).not.toContain('הערה שלי');
    expect(c.textContent).toContain('הערה של אחר');
  });

  it('cancelling the confirmation deletes nothing', async () => {
    const c = await render(member(1));
    await openCardMenu(c);
    await clickText(document.body, Strings.retroBoard.deleteCommentButton);
    await clickText(c, Strings.retroBoard.deleteCancelButton);
    expect(mockedAxios.delete).not.toHaveBeenCalled();
    expect(c.textContent).toContain('הערה שלי');
    expect(c.textContent).not.toContain(Strings.retroBoard.deleteConfirmText);
  });

  it('an admin can delete someone else\'s note (moderation) but is not offered edit', async () => {
    comments = [{ ...theirs, canDelete: true }];
    mockedAxios.delete.mockResolvedValue({ data: { id: 2 } });
    const c = await render();
    await openCardMenu(c);
    expect(document.body.textContent).not.toContain(Strings.retroBoard.editCommentButton);
    await clickText(document.body, Strings.retroBoard.deleteCommentButton);
    expect(c.textContent).toContain(Strings.retroBoard.deleteModerationHint);
    await clickText(c, Strings.retroBoard.deleteConfirmButton);
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/comments/2'), expect.anything());
  });
});

describe('SprintRetroBoardWeb — admin-only panels (feature 13)', () => {
  it('a team admin sees both panels; a team leader who is not an admin, and a member, see neither', async () => {
    let c = await render(member(1, { isAdmin: true, role: 'MEMBER' }));
    expect(c.textContent).toContain(Strings.retroBoard.extensionsPanelTitle);
    expect(c.textContent).toContain(Strings.retroBoard.deletedPanelTitle);
    mounted!.unmount();

    c = await render(member(1, { isAdmin: false, role: 'TEAM_LEADER' }));
    expect(c.textContent).not.toContain(Strings.retroBoard.extensionsPanelTitle);
    expect(c.textContent).not.toContain(Strings.retroBoard.deletedPanelTitle);
    mounted!.unmount();

    c = await render(member(1));
    expect(c.textContent).not.toContain(Strings.retroBoard.extensionsPanelTitle);
    expect(c.textContent).not.toContain(Strings.retroBoard.deletedPanelTitle);
  });

  it('"הערות שנמחקו" loads only when opened, and keeps an anonymous author masked', async () => {
    deleted = [
      { id: 9, type: 'IMPROVE', content: 'נמחקה אנונימית', isAnonymous: true, category: null, author: { username: 'Anonymous', firstName: 'Anonymous', lastName: '' }, deletedAt: '2026-10-20T10:00:00.000Z', deletedBy: null, deletedByAuthor: true },
      { id: 8, type: 'KEEP', content: 'נמחקה על ידי מנהל', isAnonymous: false, category: null, author: { username: 'dev', firstName: 'דנה', lastName: 'כהן' }, deletedAt: '2026-10-19T10:00:00.000Z', deletedBy: { id: 1, username: 'admin', firstName: 'נוה', lastName: '' }, deletedByAuthor: false },
    ];
    const c = await render();
    const deletedCalls = () => mockedAxios.get.mock.calls.filter(([url]) => String(url).includes('/comments/deleted')).length;
    expect(deletedCalls()).toBe(0);

    const panel = Array.from(c.querySelectorAll('h2')).find((h) => h.textContent === Strings.retroBoard.deletedPanelTitle)!.closest('div')!.parentElement!;
    const openButton = Array.from(panel.querySelectorAll('button')).find((b) => b.textContent === Strings.retroBoard.adminToolsOpenButton)!;
    await act(async () => { openButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    await flush();
    expect(deletedCalls()).toBe(1);

    const items = Array.from(c.querySelectorAll('[data-testid="deleted-comment"]'));
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('נמחקה אנונימית');
    expect(items[0].textContent).toContain(Strings.retroBoard.anonymousAuthor);
    expect(items[0].textContent).toContain(Strings.retroBoard.deletedByAuthor);
    expect(items[0].textContent).not.toContain('Anonymous');
    expect(items[1].textContent).toContain(Strings.retroBoard.deletedBy('נוה'));
    expect(items[1].textContent).toContain('דנה כהן');
  });

  it('"הארכת כתיבה" lists active extensions (opened on demand) and revoking one removes it', async () => {
    const ext = { id: 3, sprintId: 5, userId: 21, expiresAt: '2026-10-30T20:59:59.999Z', user: { id: 21, username: 'u21', firstName: 'שם21', lastName: '' } };
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/write-extensions')) return Promise.resolve({ data: [ext] });
      if (url.includes('/comments/deleted')) return Promise.resolve({ data: [] });
      if (url.includes('/comments')) return Promise.resolve({ data: comments });
      if (url.includes('/write-access')) return Promise.resolve({ data: access });
      return Promise.resolve({ data: [] });
    });
    mockedAxios.delete.mockResolvedValue({ data: { success: true } });
    const c = await render();
    const panel = Array.from(c.querySelectorAll('h2')).find((h) => h.textContent === Strings.retroBoard.extensionsPanelTitle)!.closest('div')!.parentElement!;
    const openButton = Array.from(panel.querySelectorAll('button')).find((b) => b.textContent === Strings.retroBoard.adminToolsOpenButton)!;
    await act(async () => { openButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    await flush();

    expect(c.querySelectorAll('[data-testid="write-extension"]')).toHaveLength(1);
    expect(c.textContent).toContain(Strings.retroBoard.extensionsUntil(formatDate(ext.expiresAt)));

    // the button reads "הסר הארכה" but its accessible name says whose extension it removes
    const revoke = c.querySelector<HTMLElement>('[data-testid="write-extension"] button')!;
    expect(revoke.textContent).toContain(Strings.retroBoard.extensionsRevokeButton);
    expect(revoke.getAttribute('aria-label')).toBe(Strings.retroBoard.extensionsRevokeLabel('שם21'));
    await clickText(c, Strings.retroBoard.extensionsRevokeButton);
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-extensions/3'), { headers: { Authorization: 'Bearer tok' } });
    expect(c.querySelectorAll('[data-testid="write-extension"]')).toHaveLength(0);
  });
});

describe('SprintRetroBoardWeb — admin panel toggles (accessibility)', () => {
  const toggleOf = (c: HTMLElement, title: string) =>
    Array.from(Array.from(c.querySelectorAll('h2')).find((h) => h.textContent === title)!.closest('div')!.parentElement!.querySelectorAll('button'))
      .find((b) => b.textContent === Strings.retroBoard.adminToolsOpenButton || b.textContent === Strings.retroBoard.adminToolsCloseButton)!;
  const click = async (el: Element) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await flush(); };

  it.each([
    ['deletedPanelTitle', 'deletedPanelOpenLabel', 'deletedPanelCloseLabel'],
    ['extensionsPanelTitle', 'extensionsPanelOpenLabel', 'extensionsPanelCloseLabel'],
  ] as const)('%s toggle names its panel, exposes expanded state and controls the revealed region', async (titleKey, openKey, closeKey) => {
    const c = await render();
    let button = toggleOf(c, Strings.retroBoard[titleKey]);
    expect(button.getAttribute('aria-label')).toBe(Strings.retroBoard[openKey]);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.querySelector('[data-icon]')).toBeNull(); // no trash / pencil icon on a show/hide control
    const regionId = button.getAttribute('aria-controls')!;
    expect(regionId).toBeTruthy();

    await click(button);
    button = toggleOf(c, Strings.retroBoard[titleKey]);
    expect(button.getAttribute('aria-label')).toBe(Strings.retroBoard[closeKey]);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(regionId)).not.toBeNull();
  });

  it('opening and closing a panel are both tracked', async () => {
    const c = await render();
    const button = () => toggleOf(c, Strings.retroBoard.deletedPanelTitle);
    await click(button());
    await click(button());
    expect(trackEvent).toHaveBeenCalledWith('deleted_comments_panel_opened', { sprintId: 5 });
    expect(trackEvent).toHaveBeenCalledWith('deleted_comments_panel_closed', { sprintId: 5 });
  });
});
