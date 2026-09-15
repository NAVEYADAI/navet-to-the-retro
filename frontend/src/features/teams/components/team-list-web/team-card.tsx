import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { TeamSprintsManager } from '@/features/sprints';
import { Box, Typography, List, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Card, Button, Badge, Icon } from '@/components/ui';
import { TeamMemberRow } from './team-member-row';
import { AddMemberForm } from './add-member-form';
import { AddPhantomMemberForm } from './add-phantom-member-form';
import { getMemberRank } from './roles';

interface TeamCardProps {
  team: any;
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
}

export function TeamCard({ team, token, userId, onAddMemberSuccess, onSelectSprint }: TeamCardProps) {
  const t = useTheme();
  const [isAddMemberFormVisible, setIsAddMemberFormVisible] = useState(false);
  const [isAddPhantomFormVisible, setIsAddPhantomFormVisible] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const myMembership = team.members?.find((m: any) => m.userId === userId);
  const isTeamAdmin = myMembership?.isAdmin || false;
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decision #1) —
  // `isAdmin || role === 'TEAM_LEADER'`, distinct from `isTeamAdmin` above (isAdmin-only).
  const canManageTeamContent = !!myMembership && (myMembership.isAdmin || myMembership.role === 'TEAM_LEADER');
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
    <Card>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBlockEnd: `${t.space[3]}px`,
          borderBlockEnd: `1px solid ${t.color.border}`,
        }}
      >
        <Typography sx={{ ...t.type.cardTitle, color: t.color.text, minWidth: 0 }}>
          {team.name}
        </Typography>
        {!!team.mainOffice && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
            <Icon name="map-pin" size="sm" tone="muted" />
            <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
              {Strings.teamList.officeLocationLabel}{team.mainOffice}
            </Typography>
          </Box>
        )}
      </Box>

      {isMyPendingTeam && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[3]}px` }}>
          <Badge tone="accent">{Strings.dashboard.pendingApprovalFromLabel(team.pendingApprover?.email || '')}</Badge>
          <Button size="sm" variant="danger" disabled={cancelLoading} loading={cancelLoading} onPress={handleCancelPendingTeam}>
            {Strings.dashboard.cancelPendingTeamButton}
          </Button>
        </Box>
      )}
      {isMyPendingTeam && cancelError && (
        <Alert severity="error" sx={{ ...t.type.body }}>
          {cancelError}
        </Alert>
      )}

      <Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: `${t.space[4]}px`, gap: `${t.space[2]}px` }}>
          <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, minWidth: 0 }}>
            {Strings.teamList.membersHeader(team.members?.length || 0)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
            {isTeamAdmin && !isPending && (
              <Button size="sm" variant="secondary" icon={isAddMemberFormVisible ? undefined : 'plus'} onPress={() => setIsAddMemberFormVisible(v => !v)}>
                {isAddMemberFormVisible ? Strings.dashboard.closeButton : Strings.teamList.addMemberToggle}
              </Button>
            )}
            {canManageTeamContent && !isPending && (
              <Button size="sm" variant="secondary" icon={isAddPhantomFormVisible ? undefined : 'user-plus'} onPress={() => setIsAddPhantomFormVisible(v => !v)}>
                {isAddPhantomFormVisible ? Strings.dashboard.closeButton : Strings.teamList.addPhantomMemberToggle}
              </Button>
            )}
          </Box>
        </Box>

        <List sx={{ padding: 0, display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
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
        </List>
      </Box>

      <AddMemberForm
        teamId={team.id}
        token={token}
        isVisible={isAddMemberFormVisible && !isPending}
        onInviteSent={() => {
          setIsAddMemberFormVisible(false);
          onAddMemberSuccess();
        }}
      />

      <AddPhantomMemberForm
        teamId={team.id}
        token={token}
        isVisible={isAddPhantomFormVisible && !isPending}
        onCreated={() => {
          setIsAddPhantomFormVisible(false);
          onAddMemberSuccess();
        }}
      />

      {!isPending && (
        <TeamSprintsManager
          team={team}
          token={token}
          isAdmin={isTeamAdmin}
          onSelectSprint={onSelectSprint}
        />
      )}
    </Card>
  );
}
