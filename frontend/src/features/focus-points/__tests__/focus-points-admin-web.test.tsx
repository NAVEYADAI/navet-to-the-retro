/**
 * @jest-environment jsdom
 *
 * Feature 20 §20.2: the management space (team leader / admin) — pool, proposals, selection,
 * the rating window, quota and tasks.
 */
import React from 'react';
import axios from 'axios';
import { FocusPointsAdminWeb } from '../components/focus-points-admin-web';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { mountWeb, clickText, setInput, flush, type Mounted } from '@/test-utils/web-dom';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.setTimeout(30000);

const S = Strings.focusPoints;
const team = {
  id: 1, name: 'צוות פלטפורמה',
  members: [{ userId: 7, status: 'ACTIVE', user: { username: 'dana', firstName: 'דנה', lastName: 'לוי' } }],
};

const point = (o: Record<string, unknown> = {}) => ({
  id: 10, kind: 'IMPROVE', text: 'לזרז את הבדיקות', status: 'ACTIVE', initialScore: 2, watchSprintsLeft: null, mentionCount: 1,
  sources: [{ id: 5, content: 'הבדיקות איטיות', type: 'IMPROVE', sprintId: 3 }], proposalCount: 0, mergedFromCount: 0, selectedSprintIds: [],
  currentScore: 2, history: [], tasks: [], ...o,
});

let pool: any; let proposals: any[]; let view: any;
let mounted: Mounted | null = null;

const render = async () => {
  mounted = await mountWeb(<FocusPointsAdminWeb team={team} token="tok" onBack={jest.fn()} />);
  return document.body;
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  pool = { quota: 3, activeMembers: 5, resultsHidden: false, points: [point()] };
  proposals = [{ commentId: 5, content: 'הבדיקות איטיות', type: 'IMPROVE', category: null, sprintId: 3, sprintName: 'ספרינט 3', proposerCount: 2 }];
  view = { window: 'NOT_OPEN', points: [] };
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.endsWith('/focus-point-proposals')) return Promise.resolve({ data: proposals });
    if (url.endsWith('/sprints')) return Promise.resolve({ data: [{ id: 3, name: 'ספרינט 3', startDate: '2026-01-01', endDate: '2026-01-14' }] });
    if (url.includes('/sprints/3/focus-points')) return Promise.resolve({ data: view });
    return Promise.resolve({ data: pool });
  });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('FocusPointsAdminWeb', () => {
  it('loads the pool, the proposals (a count of proposers, never names) and the picked sprint\'s state', async () => {
    const c = await render();
    expect(c.textContent).toContain('לזרז את הבדיקות');
    expect(c.textContent).toContain(S.proposerCount(2));
    expect(c.textContent).toContain(S.selectedCount(0, 3));
    expect(c.textContent).toContain(S.windowNotOpen);
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/sprints/3/focus-points'), expect.anything());
  });

  it('creating a point from a proposal prefills the text and sends the comment as its source', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} });
    const c = await render();
    await clickText(c, S.createFromProposal);
    expect(c.textContent).toContain(S.formFromProposalSubtitle);
    expect(c.querySelector('textarea')!.value).toBe('הבדיקות איטיות');
    await clickText(c, S.createButton);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/teams/1/focus-points'),
      { kind: 'IMPROVE', text: 'הבדיקות איטיות', initialScore: 3, sourceCommentIds: [5] },
      expect.anything()
    );
    expect(trackEvent).toHaveBeenCalledWith('focus_point_created', { teamId: 1, kind: 'IMPROVE', fromProposal: true });
  });

  it('a new KEEP point sends no initial score; a blank text is rejected locally', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} });
    const c = await render();
    await clickText(c, S.newPointButton);
    await clickText(c, S.createButton);
    expect(c.textContent).toContain(S.textRequiredError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    await clickText(c, S.kindKeep);
    await setInput(c.querySelector('textarea')!, 'ה-demo עובד');
    await clickText(c, S.createButton);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.anything(), { kind: 'KEEP', text: 'ה-demo עובד', initialScore: undefined, sourceCommentIds: undefined }, expect.anything());
  });

  it('shows the server message when creating fails', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { message: 'יש לקבוע ציון פתיחה בין 1 ל-5' } } });
    const c = await render();
    await clickText(c, S.newPointButton);
    await setInput(c.querySelector('textarea')!, 'x');
    await clickText(c, S.createButton);
    expect(c.textContent).toContain('יש לקבוע ציון פתיחה בין 1 ל-5');
  });

  it('selects a point for the sprint, and shows the quota message when it is full', async () => {
    mockedAxios.put.mockResolvedValue({ data: { success: true } });
    const c = await render();
    await clickText(c, S.selectForSprint);
    expect(mockedAxios.put).toHaveBeenCalledWith(expect.stringContaining('/sprints/3/focus-points/10/select'), {}, expect.anything());
    expect(trackEvent).toHaveBeenCalledWith('focus_point_selected', { teamId: 1, sprintId: 3, selectedCount: 1, quota: 3 });

    mockedAxios.put.mockRejectedValue({ response: { data: { message: 'הגעתם למכסה של 3 נקודות לספרינט' } } });
    await clickText(c, S.selectForSprint);
    expect(c.textContent).toContain('הגעתם למכסה של 3 נקודות לספרינט');
  });

  it('closing the rating window asks for confirmation, then reports the outcomes', async () => {
    view = { window: 'OPEN', points: [{ id: 10, text: 'לזרז את הבדיקות', myRating: null }] };
    mockedAxios.post.mockResolvedValue({ data: { success: true, outcomes: [{ focusPointId: 10, outcome: 'CLOSED' }] } });
    const c = await render();
    await clickText(c, S.closeWindowButton);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(c.textContent).toContain(S.closeWindowConfirm);
    await clickText(c, S.closeWindowConfirmButton);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/sprints/3/rating-close'), {}, expect.anything());
    expect(c.textContent).toContain(S.outcomeClosed);
    expect(trackEvent).toHaveBeenCalledWith('rating_window_closed', { teamId: 1, sprintId: 3, points: 1, closed: 1, archived: 0, continues: 0, notCounted: 0 });
  });

  it('a team too small to stay anonymous shows no score, with the reason', async () => {
    pool = { ...pool, resultsHidden: true, points: [point({ history: [{ sprintId: 3, sprintName: 'ספרינט 3', endedAt: '2026-01-14T23:59:59.999Z', closed: true, raterCount: 2, average: null, valid: false, trend: null }] })] };
    const c = await render();
    expect(c.textContent).toContain(S.scoreHiddenSmallTeam);
  });

  it('adds a task with an assignee, and changes a task status', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.patch.mockResolvedValue({ data: {} });
    pool = { ...pool, points: [point({ tasks: [{ id: 50, focusPointId: 10, title: 'להוסיף בדיקות', status: 'OPEN', dueDate: null, closedAt: null, assignee: null }] })] };
    const c = await render();
    await clickText(c, S.taskStatusDone);
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/focus-point-tasks/50'), { status: 'DONE' }, expect.anything());

    await clickText(c, S.addTaskButton);
    await setInput(document.body.querySelector('textarea:not([aria-hidden])') as HTMLTextAreaElement, 'משימה חדשה');
    await clickText(document.body, S.taskCreateButton);
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/focus-points/10/tasks'), { title: 'משימה חדשה', assigneeId: null, dueDate: undefined }, expect.anything());
  });

  it('dismissing a proposal and saving the quota call the server', async () => {
    mockedAxios.delete.mockResolvedValue({ data: {} });
    mockedAxios.patch.mockResolvedValue({ data: { quota: 4 } });
    const c = await render();
    await clickText(c, S.dismissProposal);
    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/comments/5/proposals'), expect.anything());
    const quota = Array.from(c.querySelectorAll<HTMLInputElement>('input[type="number"]'))[0];
    await setInput(quota, '4');
    await clickText(c, S.quotaSaveButton);
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/teams/1/focus-point-settings'), { quota: 4 }, expect.anything());
  });

  it('shows a load error', async () => {
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    const c = await render();
    expect(c.textContent).toContain(S.loadError);
  });

  it('refetches on "רענן"', async () => {
    const c = await render();
    const before = mockedAxios.get.mock.calls.length;
    await clickText(c, Strings.common.refreshButton);
    await flush();
    expect(mockedAxios.get.mock.calls.length).toBeGreaterThan(before);
  });

  it('records the screen being viewed, with the size of what the manager faces', async () => {
    await render();
    expect(trackEvent).toHaveBeenCalledWith('focus_points_screen_viewed', {
      teamId: 1, quota: 3, resultsHidden: false, activePoints: 1, keepPoints: 0, pendingProposals: 1,
    });
  });

  it('a failed manager action is recorded with its action name and HTTP status (the quota is a 409)', async () => {
    mockedAxios.put.mockRejectedValue({ response: { status: 409, data: { message: 'הגעתם למכסה של 3 נקודות לספרינט' } } });
    const c = await render();
    await clickText(c, S.selectForSprint);
    expect(trackEvent).toHaveBeenCalledWith('focus_point_action_failed', { teamId: 1, action: 'select', status: 409 });
    expect(trackEvent).not.toHaveBeenCalledWith('focus_point_selected', expect.anything());
  });

  it('a form closed without saving is an abandoned form; an empty text is a validation failure', async () => {
    const c = await render();
    await clickText(c, S.newPointButton);
    await clickText(c, S.createButton);
    expect(trackEvent).toHaveBeenCalledWith('focus_point_form_validation_failed', { mode: 'create' });
    await clickText(document.body, S.cancelButton);
    expect(trackEvent).toHaveBeenCalledWith('focus_point_form_abandoned', { mode: 'create' });
  });

  it('a failed save is recorded with its status; cancelling the close-window confirmation is recorded', async () => {
    view = { window: 'OPEN', points: [{ id: 10, text: 'x', myRating: null }] };
    mockedAxios.post.mockRejectedValue({ response: { status: 400, data: { message: 'no' } } });
    const c = await render();
    await clickText(c, S.newPointButton);
    await setInput(c.querySelector('textarea:not([aria-hidden])')!, 'x');
    await clickText(c, S.createButton);
    expect(trackEvent).toHaveBeenCalledWith('focus_point_form_submit_failed', { mode: 'create', status: 400 });
    await clickText(document.body, S.cancelButton);
    await clickText(c, S.closeWindowButton);
    expect(trackEvent).toHaveBeenCalledWith('rating_window_close_clicked');
    await clickText(c, S.cancelButton);
    expect(trackEvent).toHaveBeenCalledWith('rating_window_close_cancelled');
  });

  it('a load failure is recorded', async () => {
    mockedAxios.get.mockRejectedValue({ response: { status: 403 } });
    await render();
    expect(trackEvent).toHaveBeenCalledWith('focus_points_load_failed', { teamId: 1, status: 403 });
  });
});
