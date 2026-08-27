import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { TeamSprintsManager } from '@/features/sprints';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { nativeStyles } from './styles';
import { getRoleLabel } from './roles';
import { TeamMemberRow } from './team-member-row';
import { AddMemberForm } from './add-member-form';
import { InviteLinksPanel } from './invite-links-panel';
import type { TeamListTheme } from '@/features/teams/types';

interface TeamCardProps {
  team: any;
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
  theme: TeamListTheme;
}

export function TeamCard({ team, token, userId, onAddMemberSuccess, onSelectSprint, theme }: TeamCardProps) {
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const myMembership = team.members?.find((m: any) => m.userId === userId);
  const isTeamAdmin = myMembership?.isAdmin || false;

  const isPending = team.status === 'PENDING_APPROVAL';
  const isMyPendingTeam = isPending && team.creatorId === userId;

  const handleCancelPendingTeam = async () => {
    setCancelError(null);
    setCancelLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/decline`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onAddMemberSuccess();
    } catch (err: any) {
      setCancelError(err.response?.data?.message || err.message || Strings.dashboard.teamActionFailedError);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <View style={[nativeStyles.infoSection, { backgroundColor: theme.backgroundElement }]}>
      <View style={nativeStyles.teamHeaderRow}>
        <View style={{ flex: 1, marginLeft: Spacing.two }}>
          <ThemedText type="subtitle" style={{ fontWeight: 'bold', textAlign: 'right' }}>
            {team.name}
          </ThemedText>
        </View>
        <View style={[nativeStyles.roleBadge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText style={[nativeStyles.roleText, { color: theme.text }]}>
            {`${team.roleInTeam ? getRoleLabel(team.roleInTeam) : ''}${isTeamAdmin ? ' • מנהל' : ''}`}
          </ThemedText>
        </View>
      </View>

      {isMyPendingTeam && (
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two }}>
          <View style={[nativeStyles.roleBadge, { backgroundColor: '#ede9fe' }]}>
            <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: '#6366f1' }}>
              {Strings.dashboard.pendingApprovalFromLabel(team.pendingApprover?.email || '')}
            </ThemedText>
          </View>
          <TouchableOpacity onPress={handleCancelPendingTeam} disabled={cancelLoading}>
            <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: '#c62828' }}>
              {Strings.dashboard.cancelPendingTeamButton}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
      {isMyPendingTeam && !!cancelError && (
        <View style={nativeStyles.errorBannerInline}>
          <ThemedText style={nativeStyles.errorTextInline}>{cancelError}</ThemedText>
        </View>
      )}

      {!!team.mainOffice && (
        <View style={nativeStyles.infoRow}>
          <ThemedText type="default" style={{ fontWeight: 'bold', textAlign: 'right' }}>
            {Strings.teamList.officeLocationLabel}
          </ThemedText>
          <ThemedText type="default" style={{ textAlign: 'right' }}>{team.mainOffice}</ThemedText>
        </View>
      )}

      <View style={nativeStyles.membersContainer}>
        <ThemedText type="default" style={{ fontWeight: 'bold', marginBottom: Spacing.one, textAlign: 'right' }}>
          {Strings.teamList.membersHeader(team.members?.length || 0)}
        </ThemedText>
        {team.members?.map((member: any) => (
          <TeamMemberRow
            key={member.id}
            member={member}
            teamId={team.id}
            token={token}
            isTeamAdmin={isTeamAdmin}
            isMe={member.userId === userId}
            onChanged={onAddMemberSuccess}
            theme={theme}
          />
        ))}
      </View>

      {isTeamAdmin && !isPending && (
        <AddMemberForm teamId={team.id} token={token} onInviteSent={onAddMemberSuccess} theme={theme} />
      )}

      {isTeamAdmin && !isPending && (
        <InviteLinksPanel teamId={team.id} token={token} theme={theme} />
      )}

      {!isPending && (
        <TeamSprintsManager
          team={team}
          token={token}
          isAdmin={isTeamAdmin}
          theme={theme}
          onSelectSprint={onSelectSprint}
        />
      )}
    </View>
  );
}
