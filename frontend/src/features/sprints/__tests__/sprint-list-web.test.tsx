/**
 * @jest-environment jsdom
 */
import React from 'react';
import axios from 'axios';
import { TeamSprintsManagerWeb } from '../components/sprint-list-web';
import { Strings } from '@/constants/strings';
import { act } from 'react';
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
const filterButton = (c: HTMLElement) => c.querySelector<HTMLElement>(`[aria-label="${Strings.sprints.filterButtonLabel}"]`);

/** Opens the filter menu (rendered in a portal on document.body) and picks an option. */
const chooseFilter = async (c: HTMLElement, label: string) => {
  const button = filterButton(c);
  if (!button) throw new Error('filter button not rendered');
  await act(async () => { button.click(); });
  const item = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((el) => el.textContent?.trim() === label);
  if (!item) throw new Error(`menu item "${label}" not found`);
  await act(async () => { item.click(); });
  await flush();
};

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

    await chooseFilter(c, Strings.sprints.filterOptions.active);
    expect(c.textContent).toContain('Sprint Active');
    expect(c.textContent).not.toContain('Sprint Future');
    // The filtered button shows which filter is on.
    expect(filterButton(c)?.textContent).toContain(Strings.sprints.filterOptions.active);
  });

  it('shows the filter button only when more than one sprint is listed outside the collapsed ended group', async () => {
    mockedAxios.get.mockResolvedValue({ data: [sprints[0], sprints[2]] }); // one active + one long-ended
    const c = await render();
    expect(filterButton(c)).toBeNull();
  });

  it('shows a progress bar on the active sprint and "starts in N days" on the upcoming one', async () => {
    const c = await render();
    expect(c.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(c.textContent).toContain(Strings.sprints.progressText(2, 3));
    expect(c.textContent).toContain(Strings.sprints.startsInBadge(5));
  });

  it('shows a "nothing in this filter" message instead of an empty box when no sprint matches', async () => {
    mockedAxios.get.mockResolvedValue({ data: [sprints[1], { id: 4, name: 'Sprint Future 2', startDate: iso(7), endDate: iso(12) }] }); // only future sprints
    const c = await render();
    await chooseFilter(c, Strings.sprints.filterOptions.active);
    expect(c.textContent).toContain(Strings.sprints.noSprintsInFilterText);
  });

  it('BUG-58: renders dates in he-IL (dd.mm.yyyy), not the browser-default US format', async () => {
    // Years other than the current one keep the full he-IL date; the current year is shortened (format-date tests).
    mockedAxios.get.mockResolvedValue({ data: [{ id: 1, name: 'Sprint Active', startDate: '2025-09-28T12:00:00.000Z', endDate: '2099-10-05T12:00:00.000Z' }] });
    const c = await render();
    expect(c.textContent).toContain('28.9.2025');
    expect(c.textContent).toContain('5.10.2099');
    expect(c.textContent).not.toContain('9/28/2025');
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

  describe('sprint lifecycle grouping', () => {
    const lifecycle = [
      { id: 1, name: 'Sprint Active', startDate: iso(-5), endDate: iso(5) },
      { id: 2, name: 'Sprint Just Ended', startDate: iso(-15), endDate: iso(-2) },
      { id: 3, name: 'Sprint Long Gone', startDate: iso(-40), endDate: iso(-30) },
    ];

    it('keeps a sprint that ended within 3 days in the main list with an "ended" marker', async () => {
      mockedAxios.get.mockResolvedValue({ data: lifecycle });
      const c = await render();
      expect(c.textContent).toContain(Strings.sprints.recentHeader);
      expect(c.textContent).toContain('Sprint Just Ended');
      expect(c.textContent).toContain(Strings.sprints.endedBadge);
    });

    it('moves older sprints into the collapsed "ספרינטים שהסתיימו" group, hidden until expanded', async () => {
      mockedAxios.get.mockResolvedValue({ data: lifecycle });
      const c = await render();
      expect(c.textContent).toContain(Strings.sprints.expiredHeader(1));
      expect(c.textContent).not.toContain('Sprint Long Gone');

      await clickText(c, Strings.sprints.expiredHeader(1));
      expect(c.textContent).toContain('Sprint Long Gone');
    });

    it('hides the recent and expired groups under the "פעילים" filter', async () => {
      mockedAxios.get.mockResolvedValue({ data: lifecycle });
      const c = await render();
      await chooseFilter(c, Strings.sprints.filterOptions.active);
      expect(c.textContent).not.toContain(Strings.sprints.recentHeader);
      expect(c.textContent).not.toContain(Strings.sprints.expiredHeader(1));
    });
  });
});
