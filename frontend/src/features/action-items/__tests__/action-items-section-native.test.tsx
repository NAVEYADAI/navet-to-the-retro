import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { ActionItemsSectionNative } from '../components/action-items-section-native';
import { MyActionItemsCardNative } from '../components/my-action-items-card-native';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import type { ActionItem } from '../types';

jest.setTimeout(30000);

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

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
  team: { id: 1, name: 'צוות א' }, sprint: { id: 5, name: 'ספרינט 5' }, assignees: [], ...overrides,
});
const previousItem = item({ id: 10, sprintId: 4, title: 'לתקן את ה-CI', sprint: { id: 4, name: 'ספרינט 4' } });
const currentItem = item({ id: 11, sprintId: 5, title: 'לכתוב תיעוד' });

const renderSection = (props: Partial<React.ComponentProps<typeof ActionItemsSectionNative>> = {}) =>
  render(<ActionItemsSectionNative team={team} sprintId={5} token="t" draft={null} onDraftHandled={jest.fn()} refreshKey={0} {...props} />);

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockedAxios.get.mockResolvedValue({ data: [previousItem, currentItem] });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('ActionItemsSectionNative', () => {
  it('shows the previous-retro strip and closes a task from it', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { ...previousItem, status: 'DONE' } });
    const { findByText, getByText, queryByText } = await renderSection();

    expect(await findByText(Strings.actionItems.previousTitle)).toBeTruthy();
    expect(getByText('לתקן את ה-CI')).toBeTruthy();

    await fireEvent.press(getByText(Strings.actionItems.markDoneButton));
    await waitFor(() => expect(queryByText('לתקן את ה-CI')).toBeNull());
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/action-items/10'), { status: 'DONE' }, expect.anything());
    expect(trackEvent).toHaveBeenCalledWith('previous_action_items_status_changed', { status: 'DONE' });
  });

  it('opens the form from a comment draft and POSTs with the comment link and chosen assignees', async () => {
    mockedAxios.post.mockResolvedValue({ data: item({ id: 12, sourceCommentId: 77, title: 'ה-CI איטי' }) });
    const onDraftHandled = jest.fn();
    const { findByDisplayValue, getByText, getByLabelText } = await renderSection({ draft: { title: 'ה-CI איטי', sourceCommentId: 77 }, onDraftHandled });

    expect(await findByDisplayValue('ה-CI איטי')).toBeTruthy();
    expect(onDraftHandled).toHaveBeenCalled();

    await fireEvent.press(getByText('דנה לוי'));
    await fireEvent.press(getByText('יוסי כהן'));
    await fireEvent.changeText(getByLabelText(Strings.actionItems.dueDateLabel), '2026-11-01');
    await fireEvent.press(getByText(Strings.actionItems.createButton));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sprints/5/action-items'),
        { title: 'ה-CI איטי', sourceCommentId: 77, assigneeIds: [1, 2], dueDate: '2026-11-01' },
        expect.anything()
      )
    );
    expect(trackEvent).toHaveBeenCalledWith('action_item_created', { fromComment: true });
  });

  it('rejects a blank title without calling the server', async () => {
    const { findByText, getByText, getByLabelText } = await renderSection({ draft: { title: 'x', sourceCommentId: 1 } });
    await findByText(Strings.actionItems.formCreateTitle);
    await fireEvent.changeText(getByLabelText(Strings.actionItems.titleLabel), '   ');
    await fireEvent.press(getByText(Strings.actionItems.createButton));
    expect(await findByText(Strings.actionItems.titleRequiredError)).toBeTruthy();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('expands the panel and changes a task\'s status', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { ...currentItem, status: 'DROPPED' } });
    const { findByText, getByText, getAllByText } = await renderSection();
    await fireEvent.press(await findByText(Strings.actionItems.panelTitle));
    expect(trackEvent).toHaveBeenCalledWith('action_items_panel_toggled', { open: true });
    expect(getByText('לכתוב תיעוד')).toBeTruthy();

    // "ירדה מהפרק" is also the previous-strip button — the panel's segmented control comes last.
    await fireEvent.press(getAllByText(Strings.actionItems.statusDropped).slice(-1)[0]);
    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/action-items/11'), { status: 'DROPPED' }, expect.anything())
    );
    expect(trackEvent).toHaveBeenCalledWith('action_item_status_changed', { status: 'DROPPED' });
  });

  it('deleting asks for confirmation first', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { success: true } });
    const { findByText, getByText, queryByText } = await renderSection();
    await fireEvent.press(await findByText(Strings.actionItems.panelTitle));
    await fireEvent.press(getByText(Strings.actionItems.deleteButton));
    expect(mockedAxios.delete).not.toHaveBeenCalled();
    await fireEvent.press(getByText(Strings.actionItems.deleteConfirmButton));
    await waitFor(() => expect(queryByText('לכתוב תיעוד')).toBeNull());
    expect(trackEvent).toHaveBeenCalledWith('action_item_deleted');
  });

  it('flags a departed assignee with "לא בצוות"', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [item({ id: 20, sprintId: 4, assignees: [{ id: 9, userId: 9, isActiveMember: false, user: { id: 9, username: 'gone' } }] })],
    });
    const { findByText } = await renderSection();
    expect(await findByText(Strings.actionItems.notInTeam)).toBeTruthy();
  });
});

describe('MyActionItemsCardNative', () => {
  it('lists my open tasks with their team', async () => {
    mockedAxios.get.mockResolvedValue({ data: [item({ id: 30, title: 'משימה שלי' })] });
    const { findByText, getByText } = await render(<MyActionItemsCardNative token="t" refreshKey={0} />);
    expect(await findByText(Strings.actionItems.myTasksTitle)).toBeTruthy();
    expect(getByText('משימה שלי')).toBeTruthy();
    expect(getByText('צוות א')).toBeTruthy();
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/me/action-items'), expect.objectContaining({ params: { status: 'OPEN' } }));
  });

  it('renders nothing when I have no tasks', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    const { queryByText } = await render(<MyActionItemsCardNative token="t" refreshKey={0} />);
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(queryByText(Strings.actionItems.myTasksTitle)).toBeNull();
  });
});
