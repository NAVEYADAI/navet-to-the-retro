import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import axios from 'axios';
import { LeaveTeamSection } from '../leave-team-section';
import { useLeaveTeam } from '@/features/teams/hooks/use-leave-team';
import { Strings } from '@/constants/strings';

jest.mock('axios');
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

// Feature 11 (product-backlog/11-team-leave-and-removal.md §11.2) — same flow as the web section.
describe('LeaveTeamSection (native)', () => {
  afterEach(() => jest.clearAllMocks());

  it('the last admin picks a successor, then leaves', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
    const onLeft = jest.fn();
    const me = member(1, { isAdmin: true, role: 'TEAM_LEADER' });
    const { getByText, getAllByText } = await render(<Harness members={[me, member(2)]} me={me} onLeft={onLeft} />);

    await fireEvent.press(getByText(Strings.teamList.leaveTeamButton));
    await fireEvent.press(getByText(Strings.teamList.leaveConfirmButton)); // disabled — nothing yet
    expect(mockedAxios.post).not.toHaveBeenCalled();

    // Both pickers (successor admin + optional next team leader) list User2.
    const [successorOption, leaderOption] = getAllByText('User2');
    await fireEvent.press(successorOption);
    await fireEvent.press(leaderOption);
    await fireEvent.press(getByText(Strings.teamList.leaveConfirmButton));

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/teams/9/leave'),
      { successorAdminMemberId: 2, newLeaderMemberId: 2 },
      { headers: { Authorization: 'Bearer tok' } }
    );
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it('a team leader who is not an admin is not asked about the next team leader', async () => {
    const me = member(1, { role: 'TEAM_LEADER' });
    const { getByText, queryByText } = await render(<Harness members={[me, member(2, { isAdmin: true })]} me={me} onLeft={jest.fn()} />);

    await fireEvent.press(getByText(Strings.teamList.leaveTeamButton));

    expect(queryByText(Strings.teamList.newLeaderLabel)).toBeNull();
    expect(queryByText(Strings.teamList.leaveSuccessorLabel)).toBeNull();
  });

  it('the last real member cannot leave', async () => {
    const me = member(1, { isAdmin: true });
    const { getByText, queryByText } = await render(<Harness members={[me]} me={me} onLeft={jest.fn()} />);

    await fireEvent.press(getByText(Strings.teamList.leaveTeamButton));

    expect(getByText(Strings.teamList.leaveLastMemberText)).toBeTruthy();
    expect(queryByText(Strings.teamList.leaveConfirmButton)).toBeNull();
  });
});
