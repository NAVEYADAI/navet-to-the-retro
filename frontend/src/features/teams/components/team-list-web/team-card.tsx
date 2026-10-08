import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { TeamSprintsManager } from '@/features/sprints';
import { getSprintState } from '@/features/sprints/sprint-lifecycle';
import { Box, Typography, Alert } from '@mui/material';
import { trackEvent } from '@/lib/analytics';
import { useTheme } from '@/design/theme-context';
import { Card, Button, Badge } from '@/components/ui';
import { TeamCardHeader } from './team-card-header';
import { TeamMemberRow } from './team-member-row';
import { AddMemberModal } from './add-member-modal';
import { TeamSettingsPanelWeb } from './team-settings-panel';
import { getMemberRank } from './roles';

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
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [activeSprintCount, setActiveSprintCount] = useState<number | null>(null);
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
  const isMyPendingTeam = isPending && team.creatorId === userId;
  const canAddMembers = canManageTeamContent && !isPending;
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

  const sectionSx = {
    borderBlockStart: `1px solid ${t.color.border}`,
    // בטלפון ריווח צדדי קטן יותר — הכרטיס כבר בתוך שוליים של הדף. מיושר לראש הכרטיס.
    paddingInline: { xs: `${t.space[4]}px`, sm: `${t.space[5]}px` },
    paddingBlockStart: `${t.space[4]}px`,
  };
  const panelSx = { ...sectionSx, backgroundColor: t.color.bg };
  const panelTitleSx = { ...t.type.overline, color: t.color.textMuted, textTransform: 'uppercase', minWidth: 0 };

  return (
    <Card padding={0}>
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
        <Box sx={{ ...panelSx, paddingBlockEnd: `${t.space[2]}px` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px`, marginBlockEnd: `${t.space[1]}px`, minHeight: t.layout.minTouchTarget }}>
            <Typography sx={panelTitleSx}>{Strings.teamList.membersHeader}</Typography>
            {canAddMembers && (
              <Button
                variant="primary"
                icon="user-plus"
                onPress={() => {
                  trackEvent('add_member_modal_opened');
                  setIsAddMemberOpen(true);
                }}
              >
                {Strings.teamList.addMemberToggle}
              </Button>
            )}
          </Box>
          <Box component="ul" sx={{ margin: 0, padding: 0 }}>
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
          </Box>
        </Box>
      )}

      {openPanel === 'settings' && (
        <Box sx={{ ...panelSx, paddingBlockEnd: `${t.space[5]}px` }}>
          <TeamSettingsPanelWeb
            teamId={team.id}
            token={token}
            isTeamAdmin={isTeamAdmin}
            teamName={team.name}
            teamOffice={team.mainOffice}
            onTeamDetailsUpdated={onAddMemberSuccess}
          />
        </Box>
      )}

      {isMyPendingTeam && (
        <Box sx={{ ...sectionSx, paddingBlockEnd: `${t.space[4]}px`, display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[3]}px` }}>
            <Badge tone="accent">{Strings.dashboard.pendingApprovalFromLabel(team.pendingApprover?.email || '')}</Badge>
            <Button size="sm" variant="danger" disabled={cancelLoading} loading={cancelLoading} onPress={handleCancelPendingTeam}>
              {Strings.dashboard.cancelPendingTeamButton}
            </Button>
          </Box>
          {cancelError && <Alert severity="error" sx={{ ...t.type.body }}>{cancelError}</Alert>}
        </Box>
      )}

      {!isPending && (
        <Box sx={{ ...sectionSx, paddingBlockEnd: `${t.space[2]}px` }}>
          <TeamSprintsManager
            team={team}
            token={token}
            isAdmin={isTeamAdmin}
            onSelectSprint={onSelectSprint}
            onSprintsLoaded={(sprints) =>
              setActiveSprintCount(sprints.filter((s) => getSprintState(s.startDate, s.endDate) === 'active').length)
            }
          />
        </Box>
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
    </Card>
  );
}
