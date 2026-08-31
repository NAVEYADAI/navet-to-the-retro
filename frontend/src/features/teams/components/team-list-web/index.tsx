import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Strings } from '@/constants/strings';
import { PendingMembershipCard } from './pending-membership-card';
import { PendingApprovalCard } from './pending-approval-card';
import { TeamCard } from './team-card';

interface TeamListProps {
  teams: any[];
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
}

export function TeamListWeb({ teams, token, userId, onAddMemberSuccess, onSelectSprint }: TeamListProps) {
  const t = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
      <Typography sx={{ ...t.type.sectionTitle, color: t.color.text, textAlign: 'start' }}>
        {Strings.teamList.myTeamsHeader}
      </Typography>

      {teams.map((team) => {
        const isPending = team.status === 'PENDING_APPROVAL';
        const isMyApproval = isPending && team.pendingApproverId === userId;
        const isMyPendingMembership = team.myMembershipStatus === 'PENDING';

        if (isMyPendingMembership) {
          return (
            <PendingMembershipCard
              key={team.id}
              team={team}
              token={token}
              onResolved={onAddMemberSuccess}
            />
          );
        }

        if (isMyApproval) {
          return (
            <PendingApprovalCard
              key={team.id}
              team={team}
              token={token}
              onResolved={onAddMemberSuccess}
            />
          );
        }

        return (
          <TeamCard
            key={team.id}
            team={team}
            token={token}
            userId={userId}
            onAddMemberSuccess={onAddMemberSuccess}
            onSelectSprint={onSelectSprint}
          />
        );
      })}
    </Box>
  );
}
