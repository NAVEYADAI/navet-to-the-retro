/**
 * @jest-environment jsdom
 *
 * Covers the sprint-screen bug fixes on SprintRetroBoardWeb: BUG-12 (date validation on edit),
 * BUG-27 (clearing the description), BUG-34 (load error state), BUG-53 (length-history refresh
 * after a dates edit), BUG-54 ("highlighted only" with no hits) and BUG-58 (he-IL dates).
 */
import React from 'react';
import axios from 'axios';
import { SprintRetroBoardWeb } from '../sprint-retro-board-web';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, setInput, dateInputs, inputByPlaceholder, flush, type Mounted } from '@/test-utils/web-dom';

// Factory mock: automocking would load axios' browser build, which needs TextEncoder in jsdom.
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const sprint = { id: 5, name: 'Sprint 5', description: 'Old description', startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-15T00:00:00.000Z' };
const team = { id: 1, name: 'Core Team', creatorId: 1, members: [{ userId: 1, isAdmin: true, role: 'TEAM_LEADER', status: 'ACTIVE' }] };
const user = { id: 1, username: 'admin' };
const keepComment = { id: 1, type: 'KEEP', content: 'Good demo', isHighlighted: false, isAnonymous: false, categoryId: null, author: { username: 'dev' }, createdAt: '2026-08-04T12:00:00.000Z' };

const onOpenSummary = jest.fn();
const onOpenMemory = jest.fn();
let mounted: Mounted | null = null;
let commentsResult: () => Promise<any>;

const render = async () => {
  mounted = await mountWeb(<SprintRetroBoardWeb sprint={sprint} team={team} token="tok" user={user} onBack={jest.fn()} onOpenSummary={onOpenSummary} onOpenMemory={onOpenMemory} />);
  return mounted.container;
};
const lengthHistoryCalls = () => mockedAxios.get.mock.calls.filter(([url]) => String(url).includes('/length-history')).length;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  commentsResult = () => Promise.resolve({ data: [keepComment] });
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.includes('/comments')) return commentsResult();
    return Promise.resolve({ data: [] }); // categories, length-history
  });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function openEditForm(c: HTMLElement) {
  await clickText(c, Strings.retroBoard.editSprintButton);
}

describe('SprintRetroBoardWeb', () => {
  it('BUG-33: the summary and memory-game buttons hand off to the route callbacks instead of swapping local views', async () => {
    const c = await render();
    await clickText(c, Strings.sprintSummary.openButton);
    expect(onOpenSummary).toHaveBeenCalledTimes(1);
    expect(onOpenMemory).not.toHaveBeenCalled();
    await clickText(c, Strings.memoryBoard.openButton);
    expect(onOpenMemory).toHaveBeenCalledTimes(1);
    // The board itself stays rendered — navigation is the router's job now.
    expect(c.textContent).toContain('Sprint 5');
  });

  it('BUG-58: the header date range uses he-IL formatting', async () => {
    const c = await render();
    expect(c.textContent).toContain('1.8.2026 - 15.8.2026');
    expect(c.textContent).not.toContain('8/1/2026');
  });

  describe('sprint edit form', () => {
    it('BUG-12: end before start is rejected with a Hebrew error and no PATCH is sent', async () => {
      const c = await render();
      await openEditForm(c);
      const [start, end] = dateInputs(c);
      await setInput(start, '2026-08-20');
      await setInput(end, '2026-08-10');
      await clickText(c, Strings.teamList.saveButton);

      expect(c.textContent).toContain(Strings.sprints.endBeforeStartError);
      expect(mockedAxios.patch).not.toHaveBeenCalled();
    });

    it('BUG-12: shows the server\'s message when the backend returns 400', async () => {
      mockedAxios.patch.mockRejectedValue({ response: { data: { message: 'תאריך הסיום לא יכול להיות לפני תאריך ההתחלה' } } });
      const c = await render();
      await openEditForm(c);
      await clickText(c, Strings.teamList.saveButton); // dates untouched, so client check passes
      expect(c.textContent).toContain('תאריך הסיום לא יכול להיות לפני תאריך ההתחלה');
    });

    it('BUG-27: clearing the description sends an empty string (not undefined) so the backend clears it', async () => {
      mockedAxios.patch.mockResolvedValue({ data: { ...sprint, description: '' } });
      const c = await render();
      expect(c.textContent).toContain('Old description');
      await openEditForm(c);
      const descriptionInput = inputByPlaceholder(c, Strings.sprints.descriptionPlaceholder)!;
      expect(descriptionInput.value).toBe('Old description');
      await setInput(descriptionInput, '');
      await clickText(c, Strings.teamList.saveButton);

      expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
      const body = mockedAxios.patch.mock.calls[0][1] as any;
      expect(body.description).toBe('');
      expect(c.textContent).not.toContain('Old description');
    });
  });

  it('BUG-34: a failed comments load shows an error (not "no notes yet") and recovers on refresh', async () => {
    commentsResult = () => Promise.reject(new Error('Network Error'));
    const c = await render();
    expect(c.textContent).toContain(Strings.retroBoard.loadCommentsError);
    expect(c.textContent).not.toContain(Strings.retroBoard.emptyKeepText);
    expect(c.textContent).not.toContain(Strings.retroBoard.emptyImproveText);

    commentsResult = () => Promise.resolve({ data: [keepComment] });
    await clickText(c, Strings.common.refreshButton);
    expect(c.textContent).not.toContain(Strings.retroBoard.loadCommentsError);
    expect(c.textContent).toContain('Good demo');
  });

  it('BUG-54: "highlighted only" with zero hits says "no matching comments", not "no notes yet"', async () => {
    const c = await render();
    expect(c.textContent).toContain('Good demo');

    await clickText(c, Strings.retroBoard.highlightedOnlyFilterLabel);
    expect(c.textContent).not.toContain('Good demo');
    expect(c.textContent).toContain(Strings.retroBoard.noMatchingCommentsText);
    expect(c.textContent).not.toContain(Strings.retroBoard.emptyKeepText);
    expect(c.textContent).not.toContain(Strings.retroBoard.emptyImproveText);
  });

  it('BUG-53: an open length-history panel refetches after a successful sprint edit', async () => {
    mockedAxios.patch.mockResolvedValue({ data: { ...sprint, endDate: '2026-08-22T00:00:00.000Z' } });
    const c = await render();
    await clickText(c, Strings.retroBoard.lengthHistoryShowButton);
    expect(lengthHistoryCalls()).toBe(1);

    await openEditForm(c);
    const [, end] = dateInputs(c);
    await setInput(end, '2026-08-22');
    await clickText(c, Strings.teamList.saveButton);
    await flush();

    expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
    expect(lengthHistoryCalls()).toBe(2);
  });
});
