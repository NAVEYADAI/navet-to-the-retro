import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { SprintRetroBoardNative } from '../sprint-retro-board-native';
import { Strings } from '@/constants/strings';
import { formatDate } from '@/lib/format-date';
import { todayLocalIso } from '../../hooks/use-write-extensions';
import { trackEvent } from '@/lib/analytics';

// Feature 13 (product-backlog/13-comment-edit-delete.md §13.2) on the full native board — the twin of
// sprint-retro-board-web-comments.test.tsx.
jest.setTimeout(30000);
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

const sprint = { id: 5, name: 'Sprint 5', startDate: '2026-08-01', endDate: '2026-08-15', description: '' };
const member = (userId: number, over: Record<string, unknown> = {}) => ({
  userId, isAdmin: false, role: 'MEMBER', status: 'ACTIVE', user: { id: userId, username: `u${userId}`, firstName: `שם${userId}`, lastName: '' }, ...over,
});
const teamOf = (me: Record<string, unknown>) => ({ id: 1, name: 'Core Team', creatorId: 99, members: [me, member(21), member(22, { user: { id: 22, username: 'g', firstName: 'רוח', lastName: '', isPhantom: true } })] });
const user = { id: 1, username: 'admin' };
const mine = {
  id: 1, type: 'KEEP', content: 'הערה שלי', isAnonymous: false, categoryId: null, category: null, author: { username: 'admin' },
  createdAt: '2026-08-04T12:00:00.000Z', updatedAt: null, isMine: true, canEdit: true, canDelete: true,
};
const theirs = { ...mine, id: 2, type: 'IMPROVE', content: 'הערה של אחר', author: { username: 'dev' }, isMine: false, canEdit: false, canDelete: false };

let comments: any[];
let access: any;
let extensions: any[];

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  comments = [mine, theirs];
  access = { canWrite: true, windowOpen: true, windowDays: 3, extensionExpiresAt: null };
  extensions = [];
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.includes('/write-extensions')) return Promise.resolve({ data: extensions });
    if (url.includes('/comments/deleted')) return Promise.resolve({ data: [] });
    if (url.includes('/comments')) return Promise.resolve({ data: comments });
    if (url.includes('/write-access')) return Promise.resolve({ data: access });
    return Promise.resolve({ data: [] });
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockedAxios.patch.mockReset(); mockedAxios.delete.mockReset(); mockedAxios.post.mockReset();
});

const renderBoard = (me: Record<string, unknown> = member(1, { isAdmin: true, role: 'TEAM_LEADER' })) =>
  render(
    <SprintRetroBoardNative {...({ sprint, team: teamOf(me), token: 'tok', user, onBack: jest.fn(), onOpenSummary: jest.fn(), onOpenMemory: jest.fn() } as any)} />
  );

describe('SprintRetroBoardNative — write window (feature 13)', () => {
  it('open window: compose form, no notice', async () => {
    const { findByText, queryByTestId, getByText } = await renderBoard();
    await findByText('הערה שלי');
    expect(getByText(Strings.retroBoard.postNoteButton)).toBeTruthy();
    expect(queryByTestId('write-locked-notice')).toBeNull();
    expect(queryByTestId('write-extension-notice')).toBeNull();
  });

  it('a locked board shows "הלוח נעול לכתיבה" instead of the compose form, and the notes stay readable', async () => {
    access = { canWrite: false, windowOpen: false, windowDays: 3, extensionExpiresAt: null };
    const { findByTestId, queryByText, getByText } = await renderBoard();
    expect(await findByTestId('write-locked-notice')).toBeTruthy();
    expect(getByText(Strings.retroBoard.writeLockedTitle)).toBeTruthy();
    expect(queryByText(Strings.retroBoard.postNoteButton)).toBeNull();
    expect(getByText('הערה שלי')).toBeTruthy();
  });

  it('with an admin extension: "פתוח לך עד <תאריך>" above a working form', async () => {
    const until = '2026-10-30T20:59:59.999Z';
    access = { canWrite: true, windowOpen: false, windowDays: 3, extensionExpiresAt: until };
    const { findByText, getByText, queryByTestId } = await renderBoard();
    expect(await findByText(Strings.retroBoard.writeOpenUntil(formatDate(until)))).toBeTruthy();
    expect(getByText(Strings.retroBoard.postNoteButton)).toBeTruthy();
    expect(queryByTestId('write-locked-notice')).toBeNull();
  });
});

describe('SprintRetroBoardNative — edit and delete (feature 13)', () => {
  it('only notes the server marked as editable/deletable get the menu', async () => {
    const { findByText, getAllByLabelText } = await renderBoard(member(1));
    await findByText('הערה שלי');
    expect(getAllByLabelText(Strings.retroBoard.commentMenuLabel)).toHaveLength(1);
  });

  it('editing: one PATCH with the changed fields, the board patches its own list and shows "נערכה"', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { ...mine, content: 'הערה מתוקנת', updatedAt: '2026-08-05T09:00:00.000Z' } });
    const { findByText, getByLabelText, getByText, queryByText } = await renderBoard(member(1));
    await findByText('הערה שלי');
    await fireEvent.press(getByLabelText(Strings.retroBoard.commentMenuLabel));
    await fireEvent.press(getByText(Strings.retroBoard.editCommentButton));
    await fireEvent.changeText(getByLabelText(Strings.retroBoard.editContentLabel), 'הערה מתוקנת');
    await fireEvent.press(getByText(Strings.retroBoard.editSaveButton));

    await waitFor(() => expect(getByText('הערה מתוקנת')).toBeTruthy());
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/comments/1'), { content: 'הערה מתוקנת' }, { headers: { Authorization: 'Bearer tok' } });
    expect(queryByText('הערה שלי')).toBeNull();
    expect(getByText(new RegExp(Strings.retroBoard.editedLabel))).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith('comment_edited', { contentChanged: true, columnChanged: false, categoryChanged: false });
  });

  it('deleting: inline confirmation first, then one DELETE and the note disappears', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { id: 1 } });
    const { findByText, getByLabelText, getByText, queryByText } = await renderBoard(member(1));
    await findByText('הערה שלי');
    await fireEvent.press(getByLabelText(Strings.retroBoard.commentMenuLabel));
    await fireEvent.press(getByText(Strings.retroBoard.deleteCommentButton));
    expect(getByText(Strings.retroBoard.deleteConfirmText)).toBeTruthy();
    expect(mockedAxios.delete).not.toHaveBeenCalled();

    await fireEvent.press(getByText(Strings.retroBoard.deleteConfirmButton));
    await waitFor(() => expect(queryByText('הערה שלי')).toBeNull());
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/comments/1'), { headers: { Authorization: 'Bearer tok' } });
    expect(getByText('הערה של אחר')).toBeTruthy();
  });

  it('a rejected delete keeps the confirmation open with the server message', async () => {
    mockedAxios.delete.mockRejectedValue(Object.assign(new Error('403'), { response: { data: { message: 'הלוח נעול לכתיבה — הספרינט הסתיים' } } }));
    const { findByText, getByLabelText, getByText } = await renderBoard(member(1));
    await findByText('הערה שלי');
    await fireEvent.press(getByLabelText(Strings.retroBoard.commentMenuLabel));
    await fireEvent.press(getByText(Strings.retroBoard.deleteCommentButton));
    await fireEvent.press(getByText(Strings.retroBoard.deleteConfirmButton));
    expect(await findByText('הלוח נעול לכתיבה — הספרינט הסתיים')).toBeTruthy();
    expect(getByText('הערה שלי')).toBeTruthy();
  });

  it('an admin can delete someone else\'s note (moderation) but is not offered edit', async () => {
    comments = [{ ...theirs, canDelete: true }];
    const { findByText, getByLabelText, getByText, queryByText } = await renderBoard();
    await findByText('הערה של אחר');
    await fireEvent.press(getByLabelText(Strings.retroBoard.commentMenuLabel));
    expect(queryByText(Strings.retroBoard.editCommentButton)).toBeNull();
    await fireEvent.press(getByText(Strings.retroBoard.deleteCommentButton));
    expect(getByText(Strings.retroBoard.deleteModerationHint)).toBeTruthy();
  });
});

describe('SprintRetroBoardNative — admin-only panels (feature 13)', () => {
  it('a team admin sees both panels', async () => {
    const { findByText, getByText } = await renderBoard(member(1, { isAdmin: true }));
    await findByText('הערה שלי');
    expect(getByText(Strings.retroBoard.extensionsPanelTitle)).toBeTruthy();
    expect(getByText(Strings.retroBoard.deletedPanelTitle)).toBeTruthy();
  });

  it('a team leader who is not an admin sees neither panel', async () => {
    const { findByText, queryByText } = await renderBoard(member(1, { isAdmin: false, role: 'TEAM_LEADER' }));
    await findByText('הערה שלי');
    expect(queryByText(Strings.retroBoard.extensionsPanelTitle)).toBeNull();
    expect(queryByText(Strings.retroBoard.deletedPanelTitle)).toBeNull();
  });

  it('a plain member sees neither panel', async () => {
    const { findByText, queryByText } = await renderBoard(member(1));
    await findByText('הערה שלי');
    expect(queryByText(Strings.retroBoard.extensionsPanelTitle)).toBeNull();
    expect(queryByText(Strings.retroBoard.deletedPanelTitle)).toBeNull();
  });

  it('"הערות שנמחקו": fetched on open; an anonymous comment stays masked', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/comments/deleted')) {
        return Promise.resolve({ data: [{ id: 9, type: 'IMPROVE', content: 'נמחקה אנונימית', isAnonymous: true, category: null, author: { username: 'Anonymous', firstName: 'Anonymous', lastName: '' }, createdAt: '2026-08-04T12:00:00.000Z', deletedAt: '2026-10-20T10:00:00.000Z', deletedBy: null, deletedByAuthor: true }] });
      }
      if (url.includes('/comments')) return Promise.resolve({ data: comments });
      return Promise.resolve({ data: url.includes('/write-access') ? access : [] });
    });
    const { findByText, getAllByText, getByText, queryByText, getAllByTestId } = await renderBoard(member(1, { isAdmin: true }));
    await findByText('הערה שלי');
    expect(mockedAxios.get.mock.calls.filter(([url]) => String(url).includes('/comments/deleted'))).toHaveLength(0);
    // the deleted-comments panel is the second "פתח" (the extensions panel is first)
    await fireEvent.press(getAllByText(Strings.retroBoard.adminToolsOpenButton)[1]);
    await waitFor(() => expect(getAllByTestId('deleted-comment')).toHaveLength(1));
    expect(getByText('נמחקה אנונימית')).toBeTruthy();
    expect(queryByText('Anonymous')).toBeNull();
    expect(getByText(new RegExp(Strings.retroBoard.deletedByAuthor))).toBeTruthy();
  });

  it('"הארכת כתיבה": only real active members are offered; granting POSTs { userId, expiresAt }', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} });
    const { findByText, getAllByText, getByText, queryByText, getByLabelText } = await renderBoard(member(1, { isAdmin: true }));
    await findByText('הערה שלי');
    await fireEvent.press(getAllByText(Strings.retroBoard.adminToolsOpenButton)[0]);
    await waitFor(() => expect(getByText(Strings.retroBoard.extensionsMemberLabel)).toBeTruthy());
    expect(queryByText('רוח')).toBeNull(); // phantom
    await fireEvent.press(getByText('שם21'));
    const date = (() => { const d = new Date(); d.setDate(d.getDate() + 2); return todayLocalIso(d); })();
    await fireEvent.changeText(getByLabelText(Strings.retroBoard.extensionsEndDateLabel), date);
    await fireEvent.press(getByText(Strings.retroBoard.extensionsGrantButton));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledTimes(1));
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-extensions'), { userId: 21, expiresAt: date }, { headers: { Authorization: 'Bearer tok' } });
    expect(trackEvent).toHaveBeenCalledWith('write_extension_granted', { sprintId: 5 });
  });

  it('revoking an extension DELETEs it', async () => {
    extensions = [{ id: 3, sprintId: 5, userId: 21, expiresAt: '2026-10-30T20:59:59.999Z', user: { id: 21, username: 'u21', firstName: 'שם21', lastName: '' } }];
    mockedAxios.delete.mockResolvedValue({ data: { success: true } });
    const { findByText, getAllByText, getByText, queryByTestId } = await renderBoard(member(1, { isAdmin: true }));
    await findByText('הערה שלי');
    await fireEvent.press(getAllByText(Strings.retroBoard.adminToolsOpenButton)[0]);
    await findByText(Strings.retroBoard.extensionsUntil(formatDate(extensions[0].expiresAt)));
    await fireEvent.press(getByText(Strings.retroBoard.extensionsRevokeButton));
    await waitFor(() => expect(queryByTestId('write-extension')).toBeNull());
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-extensions/3'), { headers: { Authorization: 'Bearer tok' } });
  });
});

describe('SprintRetroBoardNative — write form gating and anonymity (feature 13 review fixes)', () => {
  const post = async (utils: Awaited<ReturnType<typeof renderBoard>>) => {
    await fireEvent.changeText(utils.getByPlaceholderText(Strings.retroBoard.notePlaceholderKeep), 'תוכן חדש');
    await fireEvent.press(utils.getByText(Strings.retroBoard.postNoteButton));
  };

  it('does not show the compose form before the first write-access response (and a locked answer never shows it)', async () => {
    let resolveAccess!: (v: any) => void;
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/write-access')) return new Promise((r) => { resolveAccess = r; });
      if (url.includes('/comments/deleted')) return Promise.resolve({ data: [] });
      if (url.includes('/comments')) return Promise.resolve({ data: comments });
      return Promise.resolve({ data: [] });
    });
    const utils = await renderBoard();
    await utils.findByText('הערה שלי');
    expect(utils.queryByText(Strings.retroBoard.postNoteButton)).toBeNull();
    await waitFor(() => resolveAccess({ data: { canWrite: false, windowOpen: false, windowDays: 3, extensionExpiresAt: null } }));
    expect(await utils.findByTestId('write-locked-notice')).toBeTruthy();
    expect(utils.queryByText(Strings.retroBoard.postNoteButton)).toBeNull();
  });

  it('a failed write-access call is fail-open', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/write-access')) return Promise.reject(new Error('Network Error'));
      if (url.includes('/comments')) return Promise.resolve({ data: comments });
      return Promise.resolve({ data: [] });
    });
    const utils = await renderBoard();
    expect(await utils.findByText(Strings.retroBoard.postNoteButton)).toBeTruthy();
  });

  it('the write input stops at the server cap (2000 characters)', async () => {
    const utils = await renderBoard();
    await utils.findByText(Strings.retroBoard.postNoteButton);
    expect(utils.getByPlaceholderText(Strings.retroBoard.notePlaceholderKeep).props.maxLength).toBe(2000);
  });

  it('anonymous allowed: the toggle is there and the note is sent anonymous', async () => {
    access = { ...access, anonymousAllowed: true };
    mockedAxios.post.mockResolvedValue({ data: {} });
    const utils = await renderBoard();
    await utils.findByText(Strings.retroBoard.postNoteButton);
    expect(utils.queryByTestId('anonymous-locked-hint')).toBeNull();
    await fireEvent.press(utils.getByLabelText(Strings.retroBoard.anonymousToggleHint));
    await post(utils);
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({ isAnonymous: true });
  });

  it('anonymous NOT allowed: no toggle, an explanation, isAnonymous false', async () => {
    access = { canWrite: true, windowOpen: false, windowDays: 3, extensionExpiresAt: '2026-10-30T20:59:59.999Z', anonymousAllowed: false };
    mockedAxios.post.mockResolvedValue({ data: {} });
    const utils = await renderBoard();
    await utils.findByText(Strings.retroBoard.postNoteButton);
    expect(utils.queryByLabelText(Strings.retroBoard.anonymousToggleHint)).toBeNull();
    expect(utils.getByTestId('anonymous-locked-hint').props.children).toBe(Strings.retroBoard.anonymousLockedHint);
    await post(utils);
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({ isAnonymous: false });
  });
});

describe('SprintRetroBoardNative — admin panels accessibility (feature 13 review fixes)', () => {
  it('the panel toggles name their panel and expose expanded state', async () => {
    const utils = await renderBoard(member(1, { isAdmin: true }));
    await utils.findByText('הערה שלי');
    const closed = utils.getByLabelText(Strings.retroBoard.deletedPanelOpenLabel);
    expect(closed.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(closed);
    const opened = await utils.findByLabelText(Strings.retroBoard.deletedPanelCloseLabel);
    expect(opened.props.accessibilityState).toMatchObject({ expanded: true });
    expect(utils.getByLabelText(Strings.retroBoard.extensionsPanelOpenLabel)).toBeTruthy();
    await fireEvent.press(opened);
    expect(trackEvent).toHaveBeenCalledWith('deleted_comments_panel_closed', { sprintId: 5 });
  });

  it('each revoke button says whose extension it removes; the date field is left-to-right; grant errors sit by the grant button', async () => {
    extensions = [{ id: 3, sprintId: 5, userId: 21, expiresAt: '2026-10-30T20:59:59.999Z', user: { id: 21, username: 'u21', firstName: 'שם21', lastName: '' } }];
    const utils = await renderBoard(member(1, { isAdmin: true }));
    await utils.findByText('הערה שלי');
    await fireEvent.press(utils.getByLabelText(Strings.retroBoard.extensionsPanelOpenLabel));
    const revoke = await utils.findByLabelText(Strings.retroBoard.extensionsRevokeLabel('שם21'));
    expect(revoke).toBeTruthy();
    expect(utils.getByText(Strings.retroBoard.extensionsRevokeButton)).toBeTruthy();

    const date = utils.getByLabelText(Strings.retroBoard.extensionsEndDateLabel);
    expect(StyleSheetFlat(date.props.style)).toMatchObject({ textAlign: 'left', writingDirection: 'ltr' });

    await fireEvent.press(utils.getByText(Strings.retroBoard.extensionsGrantButton));
    expect(utils.getByText(Strings.retroBoard.extensionsPickMemberError)).toBeTruthy();
  });
});

function StyleSheetFlat(style: any): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.map(StyleSheetFlat)) : (style ?? {});
}
