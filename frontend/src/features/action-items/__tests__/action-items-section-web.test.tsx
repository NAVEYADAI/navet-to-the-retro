/**
 * @jest-environment jsdom
 *
 * Feature 16 (product-backlog/16-action-items.md §16.2): the retro board's action-items section —
 * previous-retro strip, this sprint's panel, and the create form (also reached from a comment).
 */
import React from 'react';
import axios from 'axios';
import { ActionItemsSectionWeb } from '../components/action-items-section-web';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { mountWeb, clickText, setInput, flush, type Mounted } from '@/test-utils/web-dom';
import type { ActionItem } from '../types';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.setTimeout(20000);

const team = {
  id: 1,
  members: [
    { userId: 1, status: 'ACTIVE', user: { username: 'dana', firstName: 'דנה', lastName: 'לוי' } },
    { userId: 2, status: 'ACTIVE', user: { username: 'yossi', firstName: 'יוסי', lastName: 'כהן' } },
  ],
};

const item = (overrides: Partial<ActionItem>): ActionItem => ({
  id: 1, teamId: 1, sprintId: 5, sourceCommentId: null, title: 'משימה', status: 'OPEN', dueDate: null,
  createdById: 1, createdAt: '2026-10-01T00:00:00.000Z', closedAt: null,
  team: { id: 1, name: 'T' }, sprint: { id: 5, name: 'ספרינט 5' }, assignees: [], ...overrides,
});

const previousItem = item({
  id: 10, sprintId: 4, title: 'לתקן את ה-CI', sprint: { id: 4, name: 'ספרינט 4' },
  assignees: [{ id: 1, userId: 1, isActiveMember: true, user: { id: 1, username: 'dana', firstName: 'דנה', lastName: 'לוי' } }],
});
const currentItem = item({ id: 11, sprintId: 5, title: 'לכתוב תיעוד' });

let mounted: Mounted | null = null;
let listed: ActionItem[];

const render = async (props: Partial<React.ComponentProps<typeof ActionItemsSectionWeb>> = {}) => {
  mounted = await mountWeb(
    <ActionItemsSectionWeb team={team} sprintId={5} token="tok" draft={null} onDraftHandled={jest.fn()} refreshKey={0} {...props} />
  );
  return document.body;
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  listed = [previousItem, currentItem];
  mockedAxios.get.mockImplementation(() => Promise.resolve({ data: listed }));
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('ActionItemsSectionWeb', () => {
  it('fetches the team\'s items and shows the previous-retro strip with only earlier open items', async () => {
    const c = await render();
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/teams/1/action-items'), expect.anything());
    expect(c.textContent).toContain(Strings.actionItems.previousTitle);
    expect(c.textContent).toContain('לתקן את ה-CI');
    // The sprint's own item lives in the (collapsed) panel, not in the strip.
    expect(c.querySelectorAll('[data-testid="previous-action-item"]')).toHaveLength(1);
    expect(c.textContent).toContain(Strings.actionItems.panelCount(1));
  });

  it('hides the strip when there is nothing open from earlier retros', async () => {
    listed = [currentItem];
    const c = await render();
    expect(c.textContent).not.toContain(Strings.actionItems.previousTitle);
  });

  it('marking a previous item done PATCHes the status, drops it from the strip and tracks the event', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { ...previousItem, status: 'DONE' } });
    const c = await render();
    await clickText(c, Strings.actionItems.markDoneButton);

    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/action-items/10'), { status: 'DONE' }, expect.anything());
    expect(c.querySelectorAll('[data-testid="previous-action-item"]')).toHaveLength(0);
    expect(trackEvent).toHaveBeenCalledWith('previous_action_items_status_changed', { status: 'DONE' });
  });

  it('"dropped" on the strip sends DROPPED', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { ...previousItem, status: 'DROPPED' } });
    const c = await render();
    await clickText(c, Strings.actionItems.markDroppedButton);
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.anything(), { status: 'DROPPED' }, expect.anything());
  });

  it('shows the server error when a status change fails, and keeps the item', async () => {
    mockedAxios.patch.mockRejectedValue({ response: { data: { message: 'Action item not found' } } });
    const c = await render();
    await clickText(c, Strings.actionItems.markDoneButton);
    expect(c.textContent).toContain('Action item not found');
    expect(c.querySelectorAll('[data-testid="previous-action-item"]')).toHaveLength(1);
  });

  it('expands the panel, lists this sprint\'s items and changes status from the segmented control', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { ...currentItem, status: 'DONE' } });
    const c = await render();
    await clickText(c, Strings.actionItems.panelTitle);
    expect(trackEvent).toHaveBeenCalledWith('action_items_panel_toggled', { open: true });
    expect(c.querySelectorAll('[data-testid="action-item-row"]')).toHaveLength(1);

    const row = c.querySelector<HTMLElement>('[data-testid="action-item-row"]')!;
    await clickText(row, Strings.actionItems.statusDone);
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/action-items/11'), { status: 'DONE' }, expect.anything());
    expect(trackEvent).toHaveBeenCalledWith('action_item_status_changed', { status: 'DONE' });
  });

  it('a free task: "משימה חדשה" opens the form, a blank title is rejected, a valid one POSTs to the sprint', async () => {
    mockedAxios.post.mockResolvedValue({ data: item({ id: 12, title: 'משימה חופשית' }) });
    const c = await render();
    await clickText(c, Strings.actionItems.panelTitle);
    await clickText(c, Strings.actionItems.newButton);

    await clickText(c, Strings.actionItems.createButton);
    expect(c.textContent).toContain(Strings.actionItems.titleRequiredError);
    expect(mockedAxios.post).not.toHaveBeenCalled();

    await setInput(c.querySelector('textarea')!, '  משימה חופשית  ');
    await clickText(c, 'דנה לוי');
    await clickText(c, 'יוסי כהן');
    await setInput(c.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-11-01');
    await clickText(c, Strings.actionItems.createButton);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/sprints/5/action-items'),
      { title: 'משימה חופשית', sourceCommentId: undefined, assigneeIds: [1, 2], dueDate: '2026-11-01' },
      expect.anything()
    );
    expect(trackEvent).toHaveBeenCalledWith('action_item_created', { fromComment: false });
    expect(c.textContent).toContain('משימה חופשית');
  });

  it('a draft from a comment opens the form prefilled, and the created task keeps the comment link', async () => {
    mockedAxios.post.mockResolvedValue({ data: item({ id: 13, sourceCommentId: 77, title: 'ה-CI איטי' }) });
    const onDraftHandled = jest.fn();
    const c = await render({ draft: { title: 'ה-CI איטי', sourceCommentId: 77 }, onDraftHandled });

    expect(onDraftHandled).toHaveBeenCalled();
    expect(c.textContent).toContain(Strings.actionItems.formFromCommentSubtitle);
    expect(c.querySelector('textarea')!.value).toBe('ה-CI איטי');

    await clickText(c, Strings.actionItems.createButton);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/sprints/5/action-items'),
      expect.objectContaining({ title: 'ה-CI איטי', sourceCommentId: 77 }),
      expect.anything()
    );
    expect(trackEvent).toHaveBeenCalledWith('action_item_created', { fromComment: true });
  });

  it('shows the server message and keeps the form open when creating fails', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { message: 'ניתן לשייך משימה רק לחברי צוות פעילים' } } });
    const c = await render({ draft: { title: 'x', sourceCommentId: 1 } });
    await clickText(c, Strings.actionItems.createButton);
    expect(c.textContent).toContain('ניתן לשייך משימה רק לחברי צוות פעילים');
    expect(c.querySelector('textarea')).not.toBeNull();
  });

  it('editing sends only the changed fields (assignees) and tracks them', async () => {
    mockedAxios.patch.mockResolvedValue({ data: currentItem });
    const c = await render();
    await clickText(c, Strings.actionItems.panelTitle);
    await clickText(c, Strings.actionItems.editButton);
    await clickText(c, 'דנה לוי');
    await clickText(c, Strings.actionItems.saveButton);

    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/action-items/11'), { assigneeIds: [1] }, expect.anything());
    expect(trackEvent).toHaveBeenCalledWith('action_item_assignees_changed', { count: 1 });
  });

  it('deleting asks for confirmation first', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { success: true } });
    const c = await render();
    await clickText(c, Strings.actionItems.panelTitle);
    await clickText(c, Strings.actionItems.deleteButton);
    expect(mockedAxios.delete).not.toHaveBeenCalled();

    await clickText(c, Strings.actionItems.deleteConfirmButton);
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/action-items/11'), expect.anything());
    expect(c.querySelectorAll('[data-testid="action-item-row"]')).toHaveLength(0);
    expect(trackEvent).toHaveBeenCalledWith('action_item_deleted');
  });

  it('shows "לא בצוות" next to an assignee who left, and "הצוות" for an unassigned task', async () => {
    listed = [
      item({ id: 20, sprintId: 4, title: 'עזב', assignees: [{ id: 9, userId: 9, isActiveMember: false, user: { id: 9, username: 'gone', firstName: 'עוזב', lastName: null } }] }),
      item({ id: 21, sprintId: 4, title: 'בלי אחראי' }),
    ];
    const c = await render();
    expect(c.textContent).toContain(Strings.actionItems.notInTeam);
    expect(c.textContent).toContain(Strings.actionItems.assigneesTeam);
  });

  it('a load error is shown and the panel is not offered', async () => {
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    const c = await render();
    expect(c.textContent).toContain(Strings.actionItems.loadError);
    expect(c.textContent).not.toContain(Strings.actionItems.newButton);
  });

  it('refetches when the screen\'s refresh key changes', async () => {
    const c = await render({ refreshKey: 0 });
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    await mounted!.rerender(
      <ActionItemsSectionWeb team={team} sprintId={5} token="tok" draft={null} onDraftHandled={jest.fn()} refreshKey={1} />
    );
    await flush();
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(c).toBeTruthy();
  });
});
