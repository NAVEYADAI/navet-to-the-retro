/**
 * @jest-environment jsdom
 */
import React from 'react';
import axios from 'axios';
import { DeletedSprintsSectionWeb } from '../deleted-sprints-section-web';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, findByText, type Mounted } from '@/test-utils/web-dom';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

let mounted: Mounted | null = null;
const onRestored = jest.fn();
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); jest.clearAllMocks(); });

const rows = () => Array.from(mounted!.container.querySelectorAll('[data-testid="deleted-sprint-row"]'));
const mount = () => mountWeb(<DeletedSprintsSectionWeb teamId={4} token="tok" onRestored={onRestored} />);

describe('DeletedSprintsSectionWeb (feature 14)', () => {
  it('is just a button until opened — no request, no list', async () => {
    mounted = await mount();
    expect(findByText(mounted.container, Strings.sprintDeletion.deletedSectionTitle)).not.toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });

  it('opening lists each deleted sprint with its comment count and days left', async () => {
    mockedAxios.get.mockResolvedValue({ data: [
      { id: 1, name: 'Old sprint', startDate: '2026-01-01', endDate: '2026-01-14', commentCount: 4, daysLeft: 20 },
      { id: 2, name: 'Last day', startDate: '2026-02-01', endDate: '2026-02-14', commentCount: 0, daysLeft: 0 },
    ] });
    mounted = await mount();
    await clickText(mounted.container, Strings.sprintDeletion.deletedSectionTitle);

    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('Old sprint');
    expect(rows()[0].textContent).toContain(Strings.sprintDeletion.commentCount(4));
    expect(rows()[0].textContent).toContain(Strings.sprintDeletion.daysLeft(20));
    expect(rows()[1].textContent).toContain(Strings.sprintDeletion.daysLeft(0));
  });

  it('an empty list says so', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    mounted = await mount();
    await clickText(mounted.container, Strings.sprintDeletion.deletedSectionTitle);
    expect(mounted.container.textContent).toContain(Strings.sprintDeletion.noDeleted);
  });

  it('"שחזר" restores that sprint, removes the row and reloads the sprint list', async () => {
    mockedAxios.get.mockResolvedValue({ data: [{ id: 1, name: 'Old sprint', startDate: '2026-01-01', endDate: '2026-01-14', commentCount: 4, daysLeft: 20 }] });
    mockedAxios.post.mockResolvedValue({ data: {} });
    mounted = await mount();
    await clickText(mounted.container, Strings.sprintDeletion.deletedSectionTitle);
    await clickText(mounted.container, Strings.sprintDeletion.restoreButton);

    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/teams/4/sprints/1/restore'), {}, { headers: { Authorization: 'Bearer tok' } });
    expect(rows()).toHaveLength(0);
    expect(onRestored).toHaveBeenCalledTimes(1);
  });
});
