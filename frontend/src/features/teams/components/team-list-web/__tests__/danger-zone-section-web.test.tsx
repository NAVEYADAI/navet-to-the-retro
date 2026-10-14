/**
 * @jest-environment jsdom
 */
import React from 'react';
import axios from 'axios';
import { DangerZoneSection } from '../danger-zone-section';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, findByText, inputByPlaceholder, setInput, flush, type Mounted } from '@/test-utils/web-dom';

jest.mock('axios', () => ({ __esModule: true, default: { delete: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

let mounted: Mounted | null = null;
const onDeleted = jest.fn();
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); jest.clearAllMocks(); });

const mount = () => mountWeb(<DangerZoneSection teamId={7} teamName="Core Team" token="tok" onDeleted={onDeleted} />);
const confirmButton = () => findByText(mounted!.container, Strings.teamDeletion.confirmButton)?.closest('button') as HTMLButtonElement;

describe('DangerZoneSection (web, feature 14)', () => {
  it('starts collapsed: the warning and a delete button, no typing field', async () => {
    mounted = await mount();
    expect(mounted.container.textContent).toContain(Strings.teamDeletion.dangerZoneTitle);
    expect(mounted.container.textContent).toContain(Strings.teamDeletion.deleteTeamDescription);
    expect(inputByPlaceholder(mounted.container, Strings.teamDeletion.confirmPlaceholder)).toBeNull();
  });

  it('asks for the exact team name and keeps "delete" disabled until it is typed', async () => {
    mounted = await mount();
    await clickText(mounted.container, Strings.teamDeletion.deleteTeamButton);
    expect(mounted.container.textContent).toContain(Strings.teamDeletion.confirmPrompt('Core Team'));
    expect(confirmButton().disabled).toBe(true);

    const input = inputByPlaceholder(mounted.container, Strings.teamDeletion.confirmPlaceholder)!;
    await setInput(input, 'Core');
    expect(confirmButton().disabled).toBe(true);
    await setInput(input, 'Core Team');
    expect(confirmButton().disabled).toBe(false);
  });

  it('confirming deletes with the typed name and tells the card to refresh', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { id: 7 } });
    mounted = await mount();
    await clickText(mounted.container, Strings.teamDeletion.deleteTeamButton);
    await setInput(inputByPlaceholder(mounted.container, Strings.teamDeletion.confirmPlaceholder)!, 'Core Team');
    await clickText(mounted.container, Strings.teamDeletion.confirmButton);

    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/teams/7'), {
      headers: { Authorization: 'Bearer tok' },
      data: { confirmName: 'Core Team' },
    });
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('cancel collapses it again without deleting; a server error is shown', async () => {
    mounted = await mount();
    await clickText(mounted.container, Strings.teamDeletion.deleteTeamButton);
    await clickText(mounted.container, Strings.teamDeletion.cancelButton);
    expect(inputByPlaceholder(mounted.container, Strings.teamDeletion.confirmPlaceholder)).toBeNull();
    expect(mockedAxios.delete).not.toHaveBeenCalled();

    mockedAxios.delete.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { message: 'Only team admins can delete the team' } } }));
    await clickText(mounted.container, Strings.teamDeletion.deleteTeamButton);
    await setInput(inputByPlaceholder(mounted.container, Strings.teamDeletion.confirmPlaceholder)!, 'Core Team');
    await clickText(mounted.container, Strings.teamDeletion.confirmButton);
    await flush();
    expect(mounted.container.textContent).toContain('Only team admins can delete the team');
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
