/**
 * @jest-environment jsdom
 *
 * Feature 20 §20.2, the team-member side: the retro board's "נקודות לשיפור" section (anonymous
 * rating), "הצע כנקודה" on a comment card, and the dashboard's "המשימות שלי".
 */
import React, { act } from 'react';
import axios from 'axios';
import { SprintFocusPointsSectionWeb } from '../components/sprint-focus-points-section-web';
import { MyFocusTasksCardWeb } from '../components/my-focus-tasks-card-web';
import { useSprintFocusPoints } from '../hooks/use-sprint-focus-points';
import { CommentCardWeb } from '@/features/retro/components/comment-card-web';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { mountWeb, clickText, setInput, type Mounted } from '@/test-utils/web-dom';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.setTimeout(30000);

const S = Strings.focusPoints;
let mounted: Mounted | null = null;
let view: any; let proposed: number[];

function Harness() {
  const focus = useSprintFocusPoints(5, 'tok');
  return <SprintFocusPointsSectionWeb focus={focus} />;
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  view = { window: 'OPEN', points: [{ id: 10, text: 'לזרז את הבדיקות', myRating: null }] };
  proposed = [];
  mockedAxios.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url.endsWith('/proposed-comments') ? proposed : view })
  );
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('sprint focus points section (member)', () => {
  it('lists the points and lets me rate 1-5 with an optional reason; it never shows a score', async () => {
    mockedAxios.put.mockResolvedValue({ data: { score: 4, reason: 'כמעט' } });
    mounted = await mountWeb(<Harness />);
    const c = mounted.container;
    expect(c.textContent).toContain(S.boardTitle);
    expect(c.textContent).toContain('לזרז את הבדיקות');
    expect(c.textContent).toContain(S.boardAnonymousNote);

    await clickText(c, '4');
    await setInput(c.querySelector('input[type="text"]')!, 'כמעט');
    await clickText(c, S.boardSaveRating);
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/focus-points/10/rating'), { sprintId: 5, score: 4, reason: 'כמעט' }, expect.anything()
    );
    // participation only — never the score or the point (PostHog knows who the user is)
    expect(trackEvent).toHaveBeenCalledWith('focus_point_rated', { sprintId: 5, isUpdate: false, hasReason: true });
    expect(c.textContent).toContain(S.boardRateSaved);
  });

  it('the save button stays disabled until a score is picked', async () => {
    mounted = await mountWeb(<Harness />);
    const save = Array.from(mounted.container.querySelectorAll('button')).find((b) => b.textContent?.includes(S.boardSaveRating))!;
    expect(save.disabled).toBe(true);
  });

  it('shows my existing rating as saved', async () => {
    view = { window: 'OPEN', points: [{ id: 10, text: 'נקודה', myRating: { score: 3, reason: null } }] };
    mounted = await mountWeb(<Harness />);
    expect(mounted.container.textContent).toContain(S.boardRateSaved);
  });

  it('a server error is shown and nothing is marked saved', async () => {
    mockedAxios.put.mockRejectedValue({ response: { data: { message: 'חלון הדירוג נסגר' } } });
    mounted = await mountWeb(<Harness />);
    await clickText(mounted.container, '5 — מצוין');
    await clickText(mounted.container, S.boardSaveRating);
    expect(mounted.container.textContent).toContain('חלון הדירוג נסגר');
    expect(mounted.container.textContent).not.toContain(S.boardRateSaved);
  });

  it('before the window opens there is no rating UI; once closed, only a notice', async () => {
    view = { window: 'NOT_OPEN', points: [{ id: 10, text: 'נקודה', myRating: null }] };
    mounted = await mountWeb(<Harness />);
    expect(mounted.container.textContent).toContain(S.boardWindowNotOpen);
    expect(mounted.container.textContent).not.toContain(S.boardSaveRating);
    mounted.unmount();
    view = { window: 'CLOSED', points: [{ id: 10, text: 'נקודה', myRating: null }] };
    mounted = await mountWeb(<Harness />);
    expect(mounted.container.textContent).toContain(S.boardWindowClosed);
    expect(mounted.container.textContent).not.toContain(S.boardSaveRating);
  });

  it('renders nothing when no point was selected for the sprint, or when the response is malformed', async () => {
    view = { window: 'OPEN', points: [] };
    mounted = await mountWeb(<Harness />);
    expect(mounted.container.textContent).toBe('');
    mounted.unmount();
    view = [{ id: 1 }];
    mounted = await mountWeb(<Harness />);
    expect(mounted.container.textContent).toBe('');
  });
});

describe('"הצע כנקודה" on a comment card', () => {
  const comment = { id: 7, content: 'הבדיקות איטיות', type: 'IMPROVE' as const, isAnonymous: true, author: { username: 'secret' }, createdAt: '2026-10-01T00:00:00.000Z' };

  it('hands over just the comment id', async () => {
    const onPropose = jest.fn();
    mounted = await mountWeb(<CommentCardWeb comment={comment} index={0} onPropose={onPropose} />);
    await clickText(mounted.container, S.proposeButton);
    expect(onPropose).toHaveBeenCalledWith(7);
  });

  it('says what the button does: "…לשיפור" for an improve comment, "…לשימור" for a keep comment, plus a hint', async () => {
    mounted = await mountWeb(<CommentCardWeb comment={comment} index={0} onPropose={jest.fn()} />);
    expect(mounted.container.textContent).toContain(S.proposeButton);
    expect(mounted.container.textContent).toContain(S.proposeHint);
    mounted.unmount();
    mounted = await mountWeb(<CommentCardWeb comment={{ ...comment, type: 'KEEP' }} index={0} onPropose={jest.fn()} />);
    expect(mounted.container.textContent).toContain(S.proposeKeepButton);
  });

  it('shows "הצעת כבר" instead of the button once proposed', async () => {
    mounted = await mountWeb(<CommentCardWeb comment={comment} index={0} onPropose={jest.fn()} isProposed />);
    expect(mounted.container.textContent).toContain(S.proposedBadge);
    expect(mounted.container.textContent).toContain(S.proposedHint);
    expect(mounted.container.textContent).not.toContain(S.proposeButton);
  });

  it('shows nothing when the host does not offer it (memory board)', async () => {
    mounted = await mountWeb(<CommentCardWeb comment={comment} index={0} />);
    expect(mounted.container.textContent).not.toContain(S.proposeButton);
  });

  it('the hook treats a 409 (already proposed) as proposed, and tracks only a real proposal', async () => {
    let focus: ReturnType<typeof useSprintFocusPoints>;
    function Probe() { focus = useSprintFocusPoints(5, 'tok'); return null; }
    mounted = await mountWeb(<Probe />);
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    await act(async () => { await focus!.propose(7); });
    expect(trackEvent).toHaveBeenCalledWith('focus_point_proposed', { sprintId: 5 });
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 409 } });
    (trackEvent as jest.Mock).mockClear();
    await act(async () => { await focus!.propose(8); });
    expect(trackEvent).not.toHaveBeenCalledWith('focus_point_proposed', expect.anything());
    expect(trackEvent).toHaveBeenCalledWith('focus_point_propose_duplicate', { sprintId: 5 });
    expect(focus!.proposedIds).toEqual(expect.arrayContaining([7, 8]));
  });
});

describe('dashboard "המשימות שלי" (focus point tasks)', () => {
  const task = { id: 30, focusPointId: 10, title: 'להוסיף בדיקות', status: 'OPEN', dueDate: null, closedAt: null, assignee: null, focusPoint: { id: 10, text: 'לזרז את הבדיקות', teamId: 1, team: { id: 1, name: 'צוות א' } } };

  it('lists my open tasks with their team and point', async () => {
    mockedAxios.get.mockResolvedValue({ data: [task] });
    mounted = await mountWeb(<MyFocusTasksCardWeb token="tok" refreshKey={0} />);
    const c = mounted.container;
    expect(c.textContent).toContain(S.myTasksTitle);
    expect(c.textContent).toContain('להוסיף בדיקות');
    expect(c.textContent).toContain('צוות א');
    expect(c.textContent).toContain('לזרז את הבדיקות');
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/me/focus-point-tasks'), expect.objectContaining({ params: { status: 'OPEN' } }));
  });

  it('renders nothing without tasks, and refetches on the refresh key', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    mounted = await mountWeb(<MyFocusTasksCardWeb token="tok" refreshKey={0} />);
    expect(mounted.container.textContent).toBe('');
    await mounted.rerender(<MyFocusTasksCardWeb token="tok" refreshKey={1} />);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});

describe('process-tracking events (member side)', () => {
  it('records the board section being seen, and a failed rating with its status', async () => {
    mockedAxios.put.mockRejectedValue({ response: { status: 409, data: { message: 'x' } } });
    mounted = await mountWeb(<Harness />);
    expect(trackEvent).toHaveBeenCalledWith('sprint_focus_points_viewed', { sprintId: 5, points: 1, window: 'OPEN', alreadyRated: 0 });
    await clickText(mounted.container, '3');
    await clickText(mounted.container, S.boardSaveRating);
    expect(trackEvent).toHaveBeenCalledWith('focus_point_rate_failed', { sprintId: 5, status: 409 });
    expect(trackEvent).not.toHaveBeenCalledWith('focus_point_rated', expect.anything());
  });

  it('marks a re-rating as an update, and never sends the score', async () => {
    view = { window: 'OPEN', points: [{ id: 10, text: 'נקודה', myRating: { score: 3, reason: null } }] };
    mockedAxios.put.mockResolvedValue({ data: {} });
    mounted = await mountWeb(<Harness />);
    expect(trackEvent).toHaveBeenCalledWith('sprint_focus_points_viewed', expect.objectContaining({ alreadyRated: 1 }));
    await clickText(mounted.container, '5 — מצוין');
    await clickText(mounted.container, S.boardSaveRating);
    expect(trackEvent).toHaveBeenCalledWith('focus_point_rated', { sprintId: 5, isUpdate: true, hasReason: false });
    for (const call of (trackEvent as jest.Mock).mock.calls) expect(JSON.stringify(call[1] ?? {})).not.toMatch(/score|pointId/);
  });

  it('a failed load is recorded', async () => {
    mockedAxios.get.mockRejectedValue({ response: { status: 500 } });
    mounted = await mountWeb(<Harness />);
    expect(trackEvent).toHaveBeenCalledWith('sprint_focus_points_load_failed', { sprintId: 5, status: 500 });
  });

  it('my tasks: "viewed" with count and overdue, only when there are tasks', async () => {
    const t = (id: number, due: string | null) => ({ id, focusPointId: 1, title: 'x', status: 'OPEN', dueDate: due, closedAt: null, assignee: null, focusPoint: { id: 1, text: 'p', teamId: 1, team: { id: 1, name: 'T' } } });
    mockedAxios.get.mockResolvedValue({ data: [t(1, '2020-01-01T00:00:00.000Z'), t(2, null)] });
    mounted = await mountWeb(<MyFocusTasksCardWeb token="tok" refreshKey={0} />);
    expect(trackEvent).toHaveBeenCalledWith('my_focus_tasks_viewed', { count: 2, overdue: 1 });
  });
});
