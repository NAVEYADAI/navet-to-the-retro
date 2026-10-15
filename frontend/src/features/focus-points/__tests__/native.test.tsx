import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { FocusPointsAdminNative } from '../components/focus-points-admin-native';
import { SprintFocusPointsSectionNative } from '../components/sprint-focus-points-section-native';
import { MyFocusTasksCardNative } from '../components/my-focus-tasks-card-native';
import { useSprintFocusPoints } from '../hooks/use-sprint-focus-points';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.setTimeout(30000);
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

const S = Strings.focusPoints;
const team = { id: 1, name: 'צוות', members: [{ userId: 7, status: 'ACTIVE', user: { username: 'dana', firstName: 'דנה', lastName: 'לוי' } }] };

const point = (o: Record<string, unknown> = {}) => ({
  id: 10, kind: 'IMPROVE', text: 'לזרז את הבדיקות', status: 'ACTIVE', initialScore: 2, watchSprintsLeft: null, mentionCount: 0,
  sources: [], proposalCount: 0, mergedFromCount: 0, selectedSprintIds: [], currentScore: 2, history: [], tasks: [], ...o,
});
let pool: any; let view: any;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  pool = { quota: 3, activeMembers: 5, resultsHidden: false, points: [point()] };
  view = { window: 'OPEN', points: [{ id: 10, text: 'לזרז את הבדיקות', myRating: null }] };
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.endsWith('/focus-point-proposals')) return Promise.resolve({ data: [{ commentId: 5, content: 'הבדיקות איטיות', type: 'IMPROVE', category: null, sprintId: 3, sprintName: 'ספרינט 3', proposerCount: 2 }] });
    if (url.endsWith('/sprints')) return Promise.resolve({ data: [{ id: 3, name: 'ספרינט 3', startDate: '2026-01-01', endDate: '2026-01-14' }] });
    if (url.includes('/proposed-comments')) return Promise.resolve({ data: [] });
    if (url.includes('/sprints/3/focus-points') || url.includes('/sprints/5/focus-points')) return Promise.resolve({ data: view });
    if (url.includes('/me/focus-point-tasks')) return Promise.resolve({ data: [{ id: 30, focusPointId: 10, title: 'משימה שלי', status: 'OPEN', dueDate: null, closedAt: null, assignee: null, focusPoint: { id: 10, text: 'נקודה', teamId: 1, team: { id: 1, name: 'צוות א' } } }] });
    return Promise.resolve({ data: pool });
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('FocusPointsAdminNative', () => {
  it('loads the pool and proposals; creates a point from a proposal and selects one for the sprint', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.put.mockResolvedValue({ data: {} });
    const { findByText, getByText, getAllByText } = await render(<FocusPointsAdminNative team={team} token="t" onBack={jest.fn()} />);
    expect(await findByText(new RegExp(S.proposerCount(2)))).toBeTruthy();
    expect(getAllByText('לזרז את הבדיקות').length).toBeGreaterThan(0);

    await fireEvent.press(getByText(S.createFromProposal));
    await fireEvent.press(getByText(S.createButton));
    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/teams/1/focus-points'),
        { kind: 'IMPROVE', text: 'הבדיקות איטיות', initialScore: 3, sourceCommentIds: [5] },
        expect.anything()
      )
    );

    await fireEvent.press(getByText(S.selectForSprint));
    await waitFor(() => expect(mockedAxios.put).toHaveBeenCalledWith(expect.stringContaining('/sprints/3/focus-points/10/select'), {}, expect.anything()));
  });

  it('closing the window asks first', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true, outcomes: [] } });
    const { findByText, getByText } = await render(<FocusPointsAdminNative team={team} token="t" onBack={jest.fn()} />);
    await fireEvent.press(await findByText(S.closeWindowButton));
    expect(mockedAxios.post).not.toHaveBeenCalled();
    await fireEvent.press(getByText(S.closeWindowConfirmButton));
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/sprints/3/rating-close'), {}, expect.anything()));
  });
});

describe('SprintFocusPointsSectionNative', () => {
  function Harness() {
    const focus = useSprintFocusPoints(5, 't');
    return <SprintFocusPointsSectionNative focus={focus} />;
  }

  it('rates a point 1-5 anonymously', async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });
    const { findByText, getByText } = await render(<Harness />);
    expect(await findByText(S.boardAnonymousNote)).toBeTruthy();
    await fireEvent.press(getByText('4'));
    await fireEvent.press(getByText(S.boardSaveRating));
    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith(expect.stringContaining('/focus-points/10/rating'), { sprintId: 5, score: 4, reason: undefined }, expect.anything())
    );
    expect(trackEvent).toHaveBeenCalledWith('focus_point_rated', { sprintId: 5, isUpdate: false, hasReason: false });
  });

  it('shows only a notice when the window is closed', async () => {
    view = { window: 'CLOSED', points: [{ id: 10, text: 'נקודה', myRating: null }] };
    const { findByText, queryByText } = await render(<Harness />);
    expect(await findByText(S.boardWindowClosed)).toBeTruthy();
    expect(queryByText(S.boardSaveRating)).toBeNull();
  });
});

describe('MyFocusTasksCardNative', () => {
  it('lists my tasks', async () => {
    const { findByText } = await render(<MyFocusTasksCardNative token="t" refreshKey={0} />);
    expect(await findByText('משימה שלי')).toBeTruthy();
  });
});
