import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import { TeamSprintsManager } from '@/features/sprints';
import { getSprintState } from '@/features/sprints/sprint-lifecycle';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { getMemberRank } from './roles';
import { TeamCardHeader } from './team-card-header';
import { rnText } from './team-settings-panel.styles';
import { TeamMemberRow } from './team-member-row';
import { AddMemberModal } from './add-member-modal';
import { TeamSettingsPanelNative } from './team-settings-panel';

interface TeamCardProps {
  team: any;
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
}

type OpenPanel = 'members' | 'settings' | null;

export function TeamCard({ team, token, userId, onAddMemberSuccess, onSelectSprint }: TeamCardProps) {
  const t = useTheme();
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [activeSprintCount, setActiveSprintCount] = useState<number | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const myMembership = team.members?.find((m: any) => m.userId === userId);
  const isTeamAdmin = myMembership?.isAdmin || false;
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decision #1) —
  // `isAdmin || role === 'TEAM_LEADER'`, distinct from `isTeamAdmin` above (isAdmin-only).
  const canManageTeamContent = !!myMembership && (myMembership.isAdmin || myMembership.role === 'TEAM_LEADER');
  // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.0
  // decision #2): same predicate as canManageTeamContent above — a separate name is kept because
  // the backlog calls it out explicitly as its own guard, matching the sprint-retro-board's
  // canHighlight/canViewLengthHistory/canPostOnBehalf pattern of named aliases for readability.
  const canManageCategories = canManageTeamContent;
  const sortedMembers = [...(team.members || [])].sort((a: any, b: any) =>
    getMemberRank(a, userId) - getMemberRank(b, userId)
  );

  const isPending = team.status === 'PENDING_APPROVAL';
  const canAddMembers = canManageTeamContent && !isPending;
  const isMyPendingTeam = isPending && team.creatorId === userId;
  const pendingMemberCount = sortedMembers.filter((m: any) => m.status === 'PENDING').length;

  const summary = [
    team.mainOffice,
    pendingMemberCount > 0 ? Strings.teamList.summaryPending(pendingMemberCount) : null,
    !isPending && activeSprintCount !== null ? Strings.teamList.summaryActiveSprints(activeSprintCount) : null,
  ].filter(Boolean).join(' · ');

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    const next = openPanel === panel ? null : panel;
    trackEvent(panel === 'members' ? 'team_members_toggled' : 'team_settings_toggled', { open: next === panel });
    setOpenPanel(next);
  };

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

  const sectionStyle = { borderTopWidth: 1, borderTopColor: t.color.border, paddingHorizontal: t.space[4], paddingTop: t.space[4] };
  const panelStyle = { ...sectionStyle, backgroundColor: t.color.bg };

  return (
    <View style={{ backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card, overflow: 'hidden' }}>
      <TeamCardHeader
        teamName={team.name}
        isTeamAdmin={isTeamAdmin}
        summary={summary}
        members={sortedMembers}
        isMembersOpen={openPanel === 'members'}
        onToggleMembers={() => togglePanel('members')}
        onToggleSettings={canManageCategories && !isPending ? () => togglePanel('settings') : undefined}
        isSettingsOpen={openPanel === 'settings'}
      />

      {openPanel === 'members' && (
        <View style={{ ...panelStyle, paddingBottom: t.space[2] }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: t.space[3], marginBottom: t.space[1], minHeight: t.layout.minTouchTarget }}>
            <Text style={[rnText(t.type.overline), { color: t.color.textMuted, textAlign: 'right' }]}>
              {Strings.teamList.membersHeader}
            </Text>
            {canAddMembers && (
              <TouchableOpacity
                onPress={() => {
                  trackEvent('add_member_modal_opened');
                  setIsAddMemberOpen(true);
                }}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: t.space[2],
                  minHeight: t.layout.minTouchTarget,
                  paddingHorizontal: t.space[4],
                  borderRadius: t.radius.field,
                  backgroundColor: t.color.accent.base,
                }}
              >
                <Icon name="user-plus" size="md" tone="inverse" />
                <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
                  {Strings.teamList.addMemberToggle}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {sortedMembers.map((member: any) => (
            <TeamMemberRow
              key={member.id}
              member={member}
              teamId={team.id}
              token={token}
              isTeamAdmin={isTeamAdmin}
              isMe={member.userId === userId}
              onChanged={onAddMemberSuccess}
              canManageTeamContent={canManageTeamContent}
            />
          ))}
        </View>
      )}

      {openPanel === 'settings' && (
        <View style={{ ...panelStyle, paddingBottom: t.space[5] }}>
          <TeamSettingsPanelNative
            teamId={team.id}
            token={token}
            isTeamAdmin={isTeamAdmin}
            teamName={team.name}
            teamOffice={team.mainOffice}
            onTeamDetailsUpdated={onAddMemberSuccess}
          />
        </View>
      )}

      {isMyPendingTeam && (
        <View style={{ ...sectionStyle, paddingBottom: t.space[4], gap: t.space[2] }}>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: t.space[2] }}>
            <View
              style={{
                backgroundColor: t.color.accent.subtle,
                borderWidth: 1,
                borderColor: t.color.accent.border,
                borderRadius: t.radius.badge,
                paddingHorizontal: t.space[2],
                paddingVertical: t.space[1],
                flexShrink: 1,
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
          {!!cancelError && (
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
        </View>
      )}

      {!isPending && (
        <View style={{ ...sectionStyle, paddingBottom: t.space[2] }}>
          <TeamSprintsManager
            team={team}
            token={token}
            isAdmin={isTeamAdmin}
            onSelectSprint={onSelectSprint}
            onSprintsLoaded={(sprints) =>
              setActiveSprintCount(sprints.filter((s) => getSprintState(s.startDate, s.endDate) === 'active').length)
            }
          />
        </View>
      )}

      {canAddMembers && (
        <AddMemberModal
          open={isAddMemberOpen}
          onClose={() => setIsAddMemberOpen(false)}
          teamId={team.id}
          teamName={team.name}
          token={token}
          canInvite={isTeamAdmin}
          canAddPhantom={canManageTeamContent}
          onMemberAdded={onAddMemberSuccess}
        />
      )}
    </View>
  );
}
