/**
 * @jest-environment jsdom
 *
 * Feature 16 §16.2: the dashboard's "המשימות שלי" card (web).
 */
import React from 'react';
import axios from 'axios';
import { MyActionItemsCardWeb } from '../components/my-action-items-card-web';
import { CommentCardWeb } from '@/features/retro/components/comment-card-web';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, type Mounted } from '@/test-utils/web-dom';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.setTimeout(20000);

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.clearAllMocks();
});

const task = {
  id: 30, teamId: 1, sprintId: 4, sourceCommentId: null, title: 'משימה שלי', status: 'OPEN', dueDate: null,
  createdById: 1, createdAt: '2026-10-01T00:00:00.000Z', closedAt: null,
  team: { id: 1, name: 'צוות א' }, sprint: { id: 4, name: 'ספרינט 4' },
  assignees: [{ id: 1, userId: 1, isActiveMember: true, user: { id: 1, username: 'dana', firstName: 'דנה', lastName: 'לוי' } }],
};

describe('MyActionItemsCardWeb', () => {
  it('lists my open tasks across teams', async () => {
    mockedAxios.get.mockResolvedValue({ data: [task] });
    mounted = await mountWeb(<MyActionItemsCardWeb token="tok" refreshKey={0} />);
    const c = mounted.container;
    expect(c.textContent).toContain(Strings.actionItems.myTasksTitle);
    expect(c.textContent).toContain('משימה שלי');
    expect(c.textContent).toContain('צוות א');
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/me/action-items'), expect.objectContaining({ params: { status: 'OPEN' } }));
  });

  it('renders nothing when there are no tasks', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    mounted = await mountWeb(<MyActionItemsCardWeb token="tok" refreshKey={0} />);
    expect(mounted.container.textContent).toBe('');
  });

  it('refetches when the dashboard refresh key changes', async () => {
    mockedAxios.get.mockResolvedValue({ data: [task] });
    mounted = await mountWeb(<MyActionItemsCardWeb token="tok" refreshKey={0} />);
    await mounted.rerender(<MyActionItemsCardWeb token="tok" refreshKey={1} />);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});

describe('CommentCardWeb "הפוך למשימה"', () => {
  const comment = { id: 7, content: 'ה-CI איטי', type: 'IMPROVE' as const, isAnonymous: true, author: { username: 'secret' }, createdAt: '2026-10-01T00:00:00.000Z' };

  it('hands over only the id and the text — never the author — for an anonymous comment', async () => {
    const onMakeTask = jest.fn();
    mounted = await mountWeb(<CommentCardWeb comment={comment} index={0} onMakeTask={onMakeTask} />);
    await clickText(mounted.container, Strings.actionItems.makeTaskButton);
    expect(onMakeTask).toHaveBeenCalledWith({ id: 7, content: 'ה-CI איטי' });
  });

  it('shows no button when the host does not offer it', async () => {
    mounted = await mountWeb(<CommentCardWeb comment={comment} index={0} />);
    expect(mounted.container.textContent).not.toContain(Strings.actionItems.makeTaskButton);
  });
});
