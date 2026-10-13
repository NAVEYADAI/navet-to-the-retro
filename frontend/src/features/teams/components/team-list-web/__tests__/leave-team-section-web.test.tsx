/**
 * @jest-environment jsdom
 */
import React from 'react';
import axios from 'axios';
import { LeaveTeamSection } from '../leave-team-section';
import { useLeaveTeam } from '@/features/teams/hooks/use-leave-team';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, findByText, type Mounted } from '@/test-utils/web-dom';

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const member = (id: number, over: Record<string, any> = {}) => ({
  id, userId: id + 100, role: 'DEVELOPER', isAdmin: false, status: 'ACTIVE',
  user: { username: `u${id}`, firstName: `User${id}`, lastName: '', isPhantom: false }, ...over,
});

function Harness({ members, me, onLeft }: { members: any[]; me: any; onLeft: () => void }) {
  const state = useLeaveTeam({ teamId: 9, members, me, token: 'tok', onLeft });
  return <LeaveTeamSection teamName="Core" state={state} />;
}

let mounted: Mounted | null = null;
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); jest.clearAllMocks(); });

const confirmButton = () => findByText(mounted!.container, Strings.teamList.leaveConfirmButton)?.closest('button') as HTMLButtonElement;

describe('LeaveTeamSection (web, feature 11)', () => {
  it('a regular member confirms and leaves', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
    const onLeft = jest.fn();
    const me = member(1);
    mounted = await mountWeb(<Harness members={[me, member(2, { isAdmin: true })]} me={me} onLeft={onLeft} />);

    await clickText(mounted.container, Strings.teamList.leaveTeamButton);
    expect(findByText(mounted.container, Strings.teamList.leaveConsequences)).not.toBeNull();
    await clickText(mounted.container, Strings.teamList.leaveConfirmButton);

    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/teams/9/leave'), {}, { headers: { Authorization: 'Bearer tok' } });
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it('the last admin cannot confirm until a successor is picked, and the successor is sent', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
    const me = member(1, { isAdmin: true });
    mounted = await mountWeb(<Harness members={[me, member(2), member(3, { user: { username: 'g', firstName: 'Ghost', isPhantom: true } })]} me={me} onLeft={jest.fn()} />);

    await clickText(mounted.container, Strings.teamList.leaveTeamButton);
    expect(confirmButton().disabled).toBe(true);
    expect(findByText(mounted.container, 'Ghost')).toBeNull(); // phantoms can't take over

    await clickText(mounted.container, 'User2');
    expect(confirmButton().disabled).toBe(false);
    await clickText(mounted.container, Strings.teamList.leaveConfirmButton);

    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/teams/9/leave'), { successorAdminMemberId: 2 }, expect.anything());
  });

  it('the last real member sees why they cannot leave, with no confirm button', async () => {
    const me = member(1, { isAdmin: true });
    mounted = await mountWeb(<Harness members={[me]} me={me} onLeft={jest.fn()} />);

    await clickText(mounted.container, Strings.teamList.leaveTeamButton);

    expect(findByText(mounted.container, Strings.teamList.leaveLastMemberText)).not.toBeNull();
    expect(findByText(mounted.container, Strings.teamList.leaveConfirmButton)).toBeNull();
  });

  it('shows the server error and stays open', async () => {
    mockedAxios.post.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { data: { message: 'שגיאת שרת' } } }));
    const onLeft = jest.fn();
    const me = member(1);
    mounted = await mountWeb(<Harness members={[me, member(2, { isAdmin: true })]} me={me} onLeft={onLeft} />);

    await clickText(mounted.container, Strings.teamList.leaveTeamButton);
    await clickText(mounted.container, Strings.teamList.leaveConfirmButton);

    expect(findByText(mounted.container, 'שגיאת שרת')).not.toBeNull();
    expect(onLeft).not.toHaveBeenCalled();
  });
});
