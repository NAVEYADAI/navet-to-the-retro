/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act } from 'react';
import axios from 'axios';
import { TeamMemberRow } from '../team-member-row';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, findByText, type Mounted } from '@/test-utils/web-dom';

// Factory mock: automocking would load axios' browser build, which needs TextEncoder in jsdom.
jest.mock('axios', () => ({ __esModule: true, default: { delete: jest.fn(), patch: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const member = {
  id: 51,
  userId: 7,
  role: 'DEVELOPER',
  isAdmin: false,
  status: 'ACTIVE',
  user: { username: 'dana', firstName: 'Dana', lastName: 'Levi', isPhantom: false },
};

let mounted: Mounted | null = null;
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const row = (onChanged = jest.fn()) => (
  <TeamMemberRow member={member} teamId={3} token="tok" isTeamAdmin={true} isMe={false} onChanged={onChanged} />
);

// Every member action sits behind the row's pencil button.
async function openActions() {
  const button = mounted!.container.querySelector(`[aria-label="${Strings.teamList.manageMemberLabel('Dana Levi')}"]`) as HTMLElement;
  await act(async () => { button.click(); });
}

describe('TeamMemberRow (web) — remove confirmation (BUG-31)', () => {
  it('"הסר" only asks for confirmation; nothing is deleted yet', async () => {
    mounted = await mountWeb(row());
    await openActions();
    await clickText(mounted.container, Strings.teamList.removeMemberButton);

    expect(findByText(mounted.container, Strings.teamList.removeMemberConfirmText('Dana Levi'))).not.toBeNull();
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it('confirming deletes the member and reports the change', async () => {
    mockedAxios.delete.mockResolvedValueOnce({ data: {} });
    const onChanged = jest.fn();
    mounted = await mountWeb(row(onChanged));
    await openActions();
    await clickText(mounted.container, Strings.teamList.removeMemberButton);
    await clickText(mounted.container, Strings.teamList.removeMemberConfirmButton);

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/teams/3/members/51'),
      { headers: { Authorization: 'Bearer tok' } }
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('cancelling closes the confirmation without deleting', async () => {
    mounted = await mountWeb(row());
    await openActions();
    await clickText(mounted.container, Strings.teamList.removeMemberButton);
    await clickText(mounted.container, Strings.teamList.removeMemberCancelButton);

    expect(findByText(mounted.container, Strings.teamList.removeMemberConfirmButton)).toBeNull();
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });
});
