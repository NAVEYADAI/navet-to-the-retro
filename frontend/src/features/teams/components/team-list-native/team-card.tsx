import React, { useState } from 'react';
import { View, Text, TouchableOpacity, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { TeamSprintsManager } from '@/features/sprints';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { getRoleLabel, getMemberRank } from './roles';
import { TeamMemberRow } from './team-member-row';
import { AddMemberForm } from './add-member-form';
import { InviteLinksPanel } from './invite-links-panel';

interface TeamCardProps {
  team: any;
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function TeamCard({ team, token, userId, onAddMemberSuccess, onSelectSprint }: TeamCardProps) {
  const t = useTheme();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const myMembership = team.members?.find((m: any) => m.userId === userId);
  const isTeamAdmin = myMembership?.isAdmin || false;
  const sortedMembers = [...(team.members || [])].sort((a: any, b: any) =>
    getMemberRank(a, userId) - getMemberRank(b, userId)
  );

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
    <View
      style={{
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.border,
        borderRadius: t.radius.card,
        padding: t.space[3],
        gap: t.space[3],
      }}
    >
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: t.space[2] }}>
        <View style={{ flex: 1 }}>
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>
            {team.name}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: t.color.surfaceSubtle,
            paddingHorizontal: t.space[2],
            paddingVertical: t.space[1],
            borderRadius: t.radius.badge,
          }}
        >
          <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.text }]}>
            {`${team.roleInTeam ? getRoleLabel(team.roleInTeam) : ''}${isTeamAdmin ? ' • מנהל' : ''}`}
          </Text>
        </View>
      </View>

      {isMyPendingTeam && (
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: t.space[2] }}>
          <View
            style={{
              backgroundColor: t.color.accent.subtle,
              borderWidth: 1,
              borderColor: t.color.accent.border,
              borderRadius: t.radius.badge,
              paddingHorizontal: t.space[2],
              paddingVertical: t.space[1],
            }}
          >
            <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.accent.base }]}>
              {Strings.dashboard.pendingApprovalFromLabel(team.pendingApprover?.email || '')}
            </Text>
          </View>
          <TouchableOpacity onPress={handleCancelPendingTeam} disabled={cancelLoading}>
            <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.status.danger.fg }]}>
              {Strings.dashboard.cancelPendingTeamButton}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {isMyPendingTeam && !!cancelError && (
        <View
          style={{
            backgroundColor: t.color.status.danger.bg,
            borderWidth: 1,
            borderColor: t.color.status.danger.border,
            borderRadius: t.radius.field,
            padding: t.space[2],
          }}
        >
          <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
            {cancelError}
          </Text>
        </View>
      )}

      {!!team.mainOffice && (
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1] }}>
          <Icon name="map-pin" size="sm" tone="muted" />
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>
            {Strings.teamList.officeLocationLabel}
          </Text>
          <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>
            {team.mainOffice}
          </Text>
        </View>
      )}

      <View style={{ gap: t.space[2] }}>
        <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>
          {Strings.teamList.membersHeader(team.members?.length || 0)}
        </Text>
        {sortedMembers.map((member: any) => (
          <TeamMemberRow
            key={member.id}
            member={member}
            teamId={team.id}
            token={token}
            isTeamAdmin={isTeamAdmin}
            isMe={member.userId === userId}
            onChanged={onAddMemberSuccess}
          />
        ))}
      </View>

      {isTeamAdmin && !isPending && (
        <AddMemberForm teamId={team.id} token={token} onInviteSent={onAddMemberSuccess} />
      )}

      {isTeamAdmin && !isPending && (
        <InviteLinksPanel teamId={team.id} token={token} />
      )}

      {!isPending && (
        <TeamSprintsManager
          team={team}
          token={token}
          isAdmin={isTeamAdmin}
          onSelectSprint={onSelectSprint}
        />
      )}
    </View>
  );
}
