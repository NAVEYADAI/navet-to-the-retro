/**
 * @jest-environment jsdom
 */
import React from 'react';
import axios from 'axios';
import { TeamSprintsManagerWeb } from '../components/sprint-list-web';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, setInput, dateInputs, inputByPlaceholder, flush, type Mounted } from '@/test-utils/web-dom';

// Factory mock: automocking would load axios' browser build, which needs TextEncoder in jsdom.
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const sprints = [
  { id: 1, name: 'Sprint Active', startDate: iso(-1), endDate: iso(1) },
  { id: 2, name: 'Sprint Future', startDate: iso(5), endDate: iso(10) },
  { id: 3, name: 'Sprint Past', startDate: iso(-10), endDate: iso(-5) },
];
const team = { id: 10, name: 'Core Team' };

let mounted: Mounted | null = null;
const render = async (isAdmin = false) => {
  mounted = await mountWeb(<TeamSprintsManagerWeb team={team} token="tok" isAdmin={isAdmin} onSelectSprint={jest.fn()} />);
  return mounted.container;
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockedAxios.get.mockResolvedValue({ data: sprints });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('TeamSprintsManagerWeb', () => {
  it('BUG-58: "הכל" shows active and upcoming sprints; "פעילים" excludes the upcoming one', async () => {
    const c = await render();
    expect(c.textContent).toContain('Sprint Active');
    expect(c.textContent).toContain('Sprint Future');

    await clickText(c, 'פעילים');
    expect(c.textContent).toContain('Sprint Active');
    expect(c.textContent).not.toContain('Sprint Future');
  });

  it('shows a "nothing in this filter" message instead of an empty box when no sprint matches', async () => {
    mockedAxios.get.mockResolvedValue({ data: [sprints[1]] }); // only a future sprint
    const c = await render();
    await clickText(c, 'פעילים');
    expect(c.textContent).toContain(Strings.sprints.noSprintsInFilterText);
  });

  it('BUG-58: renders dates in he-IL (dd.mm.yyyy), not the browser-default US format', async () => {
    mockedAxios.get.mockResolvedValue({ data: [{ id: 1, name: 'Sprint Active', startDate: '2026-09-28T12:00:00.000Z', endDate: '2099-10-05T12:00:00.000Z' }] });
    const c = await render();
    expect(c.textContent).toContain('28.9.2026');
    expect(c.textContent).not.toContain('9/28/2026');
  });

  it('BUG-34: a failed load shows the error (with the refresh button) instead of "no sprints yet"', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    const c = await render(true);
    expect(c.textContent).toContain(Strings.sprints.loadError);
    expect(c.textContent).not.toContain(Strings.sprints.noSprintsTextAdmin);
    expect(c.textContent).toContain(Strings.common.refreshButton);

    // Retry via the existing refresh button recovers.
    await clickText(c, Strings.common.refreshButton);
    expect(c.textContent).not.toContain(Strings.sprints.loadError);
    expect(c.textContent).toContain('Sprint Active');
  });

  describe('create form', () => {
    const openForm = async (c: HTMLElement) => {
      await clickText(c, Strings.sprints.newSprintButton);
    };

    it('BUG-12: end before start is rejected client-side with a Hebrew error and nothing is posted', async () => {
      const c = await render(true);
      await openForm(c);
      await setInput(inputByPlaceholder(c, Strings.sprints.sprintNamePlaceholder)!, 'New one');
      const [start, end] = dateInputs(c);
      await setInput(start, '2026-10-10');
      await setInput(end, '2026-10-09');
      await clickText(c, 'פתח ספרינט רטרו');

      expect(c.textContent).toContain(Strings.sprints.endBeforeStartError);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('BUG-12: posts when end equals or follows start', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });
      const c = await render(true);
      await openForm(c);
      await setInput(inputByPlaceholder(c, Strings.sprints.sprintNamePlaceholder)!, 'New one');
      const [start, end] = dateInputs(c);
      await setInput(start, '2026-10-10');
      await setInput(end, '2026-10-10');
      await clickText(c, 'פתח ספרינט רטרו');
      await flush();

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({ name: 'New one', startDate: '2026-10-10', endDate: '2026-10-10' });
    });

    it('BUG-12: surfaces the server\'s Hebrew message when the backend rejects the dates', async () => {
      mockedAxios.post.mockRejectedValue({ response: { data: { message: 'תאריך הסיום לא יכול להיות לפני תאריך ההתחלה' } }, message: 'Request failed' });
      const c = await render(true);
      await openForm(c);
      await setInput(inputByPlaceholder(c, Strings.sprints.sprintNamePlaceholder)!, 'New one');
      const [start, end] = dateInputs(c);
      await setInput(start, '2026-10-01');
      await setInput(end, '2026-10-05');
      await clickText(c, 'פתח ספרינט רטרו');
      await flush();

      expect(c.textContent).toContain('תאריך הסיום לא יכול להיות לפני תאריך ההתחלה');
    });
  });
});
