import React from 'react';
import { Box, Typography } from '@mui/material';
import { PendingMembershipCard } from './pending-membership-card';
import { PendingApprovalCard } from './pending-approval-card';
import { TeamCard } from './team-card';
import type { TeamListTheme } from '@/features/teams/types';

interface TeamListProps {
  teams: any[];
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
  theme: TeamListTheme;
}

export function TeamListWeb({ teams, token, userId, onAddMemberSuccess, onSelectSprint, theme }: TeamListProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.text, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
        הצוותים שלי
      </Typography>

      {teams.map((team, index) => {
        const isPending = team.status === 'PENDING_APPROVAL';
        const isMyApproval = isPending && team.pendingApproverId === userId;
        const isMyPendingMembership = team.myMembershipStatus === 'PENDING';
        const animationDelay = index * 120;

        if (isMyPendingMembership) {
          return (
            <PendingMembershipCard
              key={team.id}
              team={team}
              token={token}
              onResolved={onAddMemberSuccess}
              theme={theme}
              animationDelay={animationDelay}
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
              theme={theme}
              animationDelay={animationDelay}
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
            theme={theme}
            animationDelay={animationDelay}
          />
        );
      })}
    </Box>
  );
}
