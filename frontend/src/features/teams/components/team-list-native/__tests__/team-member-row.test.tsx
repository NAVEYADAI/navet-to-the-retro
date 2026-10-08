import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TeamMemberRow } from '../team-member-row';
import { Strings } from '@/constants/strings';

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2) — the phantom badge
// and the "send registration link" action, gated on `canManageTeamContent`
// (isAdmin || role === 'TEAM_LEADER', §9.0 decision #1), not on `isTeamAdmin` (isAdmin-only,
// which still gates the pre-existing edit/remove actions).
describe('TeamMemberRow — phantom member badge + conversion link gating', () => {
  const baseProps = {
    teamId: 1,
    token: 'mock-token',
    isMe: false,
    onChanged: jest.fn(),
  };

  const phantomMember = {
    id: 55,
    userId: 500,
    role: 'DEVELOPER',
    isAdmin: false,
    status: 'ACTIVE',
    user: { username: 'phantom_abc', firstName: 'Phanto', lastName: 'Mm', isPhantom: true },
  };

  const realMember = {
    id: 56,
    userId: 501,
    role: 'DEVELOPER',
    isAdmin: false,
    status: 'ACTIVE',
    user: { username: 'realuser', firstName: 'Real', lastName: 'User', isPhantom: false },
  };

  it('shows the phantom badge for a phantom member', async () => {
    const { getByText } = await render(
      <TeamMemberRow {...baseProps} member={phantomMember} isTeamAdmin={false} canManageTeamContent={false} />
    );

    expect(getByText(Strings.teamList.phantomBadge)).toBeTruthy();
  });

  it('does not render the phantom badge at all for a real (non-phantom) member', async () => {
    const { queryByText } = await render(
      <TeamMemberRow {...baseProps} member={realMember} isTeamAdmin={false} canManageTeamContent={false} />
    );

    expect(queryByText(Strings.teamList.phantomBadge)).toBeNull();
  });

  it('shows the "send registration link" action for a phantom member when the viewer can manage team content', async () => {
    const { getByText, getByLabelText } = await render(
      <TeamMemberRow {...baseProps} member={phantomMember} isTeamAdmin={false} canManageTeamContent={true} />
    );

    // Behind the row's pencil button, like every other member action.
    await fireEvent.press(getByLabelText(Strings.teamList.manageMemberLabel('Phanto Mm')));
    expect(getByText(Strings.invites.sendConversionLinkButton)).toBeTruthy();
  });

  it('does not render the "send registration link" action at all for a plain (non-admin, non-leader) viewer', async () => {
    const { queryByText, queryByLabelText } = await render(
      <TeamMemberRow {...baseProps} member={phantomMember} isTeamAdmin={false} canManageTeamContent={false} />
    );

    expect(queryByLabelText(Strings.teamList.manageMemberLabel('Phanto Mm'))).toBeNull();
    expect(queryByText(Strings.invites.sendConversionLinkButton)).toBeNull();
  });

  it('does not render the "send registration link" action for a real (already-converted/non-phantom) member, even for a manager', async () => {
    const { queryByText, queryByLabelText } = await render(
      <TeamMemberRow {...baseProps} member={realMember} isTeamAdmin={false} canManageTeamContent={true} />
    );

    // A leader who isn't an admin has nothing to do on a real member's row — no pencil at all.
    expect(queryByLabelText(Strings.teamList.manageMemberLabel('Real User'))).toBeNull();
    expect(queryByText(Strings.invites.sendConversionLinkButton)).toBeNull();
  });
});
