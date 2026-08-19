import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import axios from 'axios';
import { TeamListNative } from '@/features/teams/components/team-list-native';
import { Strings } from '../../constants/strings';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Isolate this component from the sprint-management subtree, which fetches its own data.
jest.mock('@/features/sprints', () => ({
  TeamSprintsManager: () => null,
}));

const mockTheme = {
  text: '#000',
  background: '#fff',
  backgroundElement: '#eee',
  backgroundSelected: '#ddd',
  textSecondary: '#666',
};

const currentUserId = 42;
const token = 'mock-token';

const pendingOnMe = {
  id: 1,
  name: 'Team A',
  status: 'PENDING_APPROVAL',
  pendingApproverId: currentUserId,
  creatorId: 100,
  members: [
    { id: 1, userId: 100, role: 'TEAM_LEADER', isAdmin: true, user: { username: 'creator1', firstName: 'Cre', lastName: 'Ator' } },
  ],
};

const myPendingTeam = {
  id: 2,
  name: 'Team B',
  status: 'PENDING_APPROVAL',
  pendingApproverId: 55,
  creatorId: currentUserId,
  pendingApprover: { email: 'approver@example.com' },
  members: [
    { id: 2, userId: currentUserId, role: 'TEAM_LEADER', isAdmin: true, user: { username: 'me', firstName: 'Me', lastName: '' } },
  ],
  roleInTeam: 'TEAM_LEADER',
};

const activeTeam = {
  id: 3,
  name: 'Team C',
  status: 'ACTIVE',
  creatorId: 100,
  members: [
    { id: 3, userId: currentUserId, role: 'DEVELOPER', isAdmin: false, user: { username: 'me', firstName: 'Me', lastName: '' } },
  ],
  roleInTeam: 'DEVELOPER',
};

const activeTeamAsAdmin = {
  id: 5,
  name: 'Team E',
  status: 'ACTIVE',
  creatorId: currentUserId,
  members: [
    { id: 50, userId: currentUserId, role: 'TEAM_LEADER', isAdmin: true, user: { username: 'me', firstName: 'Me', lastName: '' } },
    { id: 51, userId: 200, role: 'DEVELOPER', isAdmin: false, user: { username: 'other', firstName: 'Other', lastName: 'User' } },
  ],
  roleInTeam: 'TEAM_LEADER',
};

const pendingMembershipTeam = {
  id: 4,
  name: 'Team D',
  status: 'ACTIVE',
  creatorId: 100,
  members: [
    { id: 10, userId: 100, role: 'TEAM_LEADER', isAdmin: true, user: { username: 'lead', firstName: 'Lead', lastName: '' } },
  ],
  roleInTeam: null,
  myMembershipId: 42,
  myMembershipStatus: 'PENDING',
};

async function renderList(teams: any[]) {
  const onAddMemberSuccess = jest.fn();
  const utils = await render(
    <TeamListNative
      teams={teams}
      token={token}
      userId={currentUserId}
      onAddMemberSuccess={onAddMemberSuccess}
      onSelectSprint={jest.fn()}
      theme={mockTheme}
    />
  );
  return { ...utils, onAddMemberSuccess };
}

describe('TeamListNative — dual-approval UI', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows approve/decline actions for a team pending on the current user\'s approval', async () => {
    const { getByText } = await renderList([pendingOnMe]);

    expect(getByText(Strings.dashboard.approveTeamButton)).toBeTruthy();
    expect(getByText(Strings.dashboard.declineTeamButton)).toBeTruthy();
  });

  it('approves the team: posts to /teams/:id/approve with the bearer token and reports success', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    const { getByText, onAddMemberSuccess } = await renderList([pendingOnMe]);

    await fireEvent.press(getByText(Strings.dashboard.approveTeamButton));

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining(`/teams/${pendingOnMe.id}/approve`),
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(onAddMemberSuccess).toHaveBeenCalledTimes(1);
  });

  it('declines the team: posts to /teams/:id/decline with the bearer token and reports success', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    const { getByText, onAddMemberSuccess } = await renderList([pendingOnMe]);

    await fireEvent.press(getByText(Strings.dashboard.declineTeamButton));

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining(`/teams/${pendingOnMe.id}/decline`),
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(onAddMemberSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows the server error and does not report success when approval fails', async () => {
    mockedAxios.post.mockRejectedValueOnce(
      Object.assign(new Error('failed'), { response: { data: { message: 'שגיאת בדיקה' } } })
    );
    const { getByText, findByText, onAddMemberSuccess } = await renderList([pendingOnMe]);

    await fireEvent.press(getByText(Strings.dashboard.approveTeamButton));

    expect(await findByText('שגיאת בדיקה')).toBeTruthy();
    expect(onAddMemberSuccess).not.toHaveBeenCalled();
  });

  it('falls back to the generic failure message when the error has none', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error());
    const { getByText, findByText } = await renderList([pendingOnMe]);

    await fireEvent.press(getByText(Strings.dashboard.approveTeamButton));

    expect(await findByText(Strings.dashboard.teamActionFailedError)).toBeTruthy();
  });

  it('shows only a cancel control for a team the current user created and is still waiting on', async () => {
    const { getByText, queryByText } = await renderList([myPendingTeam]);

    expect(getByText(Strings.dashboard.cancelPendingTeamButton)).toBeTruthy();
    expect(queryByText(Strings.dashboard.approveTeamButton)).toBeNull();
  });

  it('cancelling a pending team posts to the decline endpoint', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    const { getByText, onAddMemberSuccess } = await renderList([myPendingTeam]);

    await fireEvent.press(getByText(Strings.dashboard.cancelPendingTeamButton));

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining(`/teams/${myPendingTeam.id}/decline`),
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(onAddMemberSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows no approve/decline/cancel controls for a regular active team', async () => {
    const { queryByText } = await renderList([activeTeam]);

    expect(queryByText(Strings.dashboard.approveTeamButton)).toBeNull();
    expect(queryByText(Strings.dashboard.declineTeamButton)).toBeNull();
    expect(queryByText(Strings.dashboard.cancelPendingTeamButton)).toBeNull();
  });

  it('shows a pending member-invite card (not the full team) when my own membership is PENDING', async () => {
    const { getByText, queryByText } = await renderList([pendingMembershipTeam]);

    expect(getByText(Strings.dashboard.memberInviteText)).toBeTruthy();
    expect(getByText(Strings.dashboard.approveTeamButton)).toBeTruthy();
    expect(getByText(Strings.dashboard.declineTeamButton)).toBeTruthy();
    // Not shown as an active member yet — no member list / sprints for an unaccepted invite.
    expect(queryByText(Strings.teamList.membersHeader(1))).toBeNull();
  });

  it('accepting a member invite posts to /teams/:id/members/:memberId/accept', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    const { getByText, onAddMemberSuccess } = await renderList([pendingMembershipTeam]);

    await fireEvent.press(getByText(Strings.dashboard.approveTeamButton));

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining(`/teams/${pendingMembershipTeam.id}/members/${pendingMembershipTeam.myMembershipId}/accept`),
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(onAddMemberSuccess).toHaveBeenCalledTimes(1);
  });

  it('declining a member invite posts to /teams/:id/members/:memberId/decline', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    const { getByText, onAddMemberSuccess } = await renderList([pendingMembershipTeam]);

    await fireEvent.press(getByText(Strings.dashboard.declineTeamButton));

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining(`/teams/${pendingMembershipTeam.id}/members/${pendingMembershipTeam.myMembershipId}/decline`),
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(onAddMemberSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows a remove control for other members (not for myself) when I am a team admin', async () => {
    const { getAllByText } = await renderList([activeTeamAsAdmin]);

    // Only one member other than myself, so exactly one remove control should render.
    expect(getAllByText('הסר 🗑️')).toHaveLength(1);
  });

  it('removing a member sends DELETE /teams/:id/members/:memberId with the bearer token', async () => {
    mockedAxios.delete.mockResolvedValueOnce({ data: { success: true } });
    const { getByText, onAddMemberSuccess } = await renderList([activeTeamAsAdmin]);

    await fireEvent.press(getByText('הסר 🗑️'));

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringContaining(`/teams/${activeTeamAsAdmin.id}/members/51`),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(onAddMemberSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows the server error when removing a member fails', async () => {
    mockedAxios.delete.mockRejectedValueOnce(
      Object.assign(new Error('failed'), { response: { data: { message: 'לא ניתן להסיר את המנהל/ת האחרון/ה' } } })
    );
    const { getByText, findByText, onAddMemberSuccess } = await renderList([activeTeamAsAdmin]);

    await fireEvent.press(getByText('הסר 🗑️'));

    expect(await findByText('לא ניתן להסיר את המנהל/ת האחרון/ה')).toBeTruthy();
    expect(onAddMemberSuccess).not.toHaveBeenCalled();
  });
});
