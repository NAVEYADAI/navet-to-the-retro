import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { PendingMembershipCard } from './pending-membership-card';
import { PendingApprovalCard } from './pending-approval-card';
import { TeamCard } from './team-card';
import { nativeStyles } from './styles';
import type { TeamListTheme } from '@/features/teams/types';

interface TeamListProps {
  teams: any[];
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
  theme: TeamListTheme;
}

export function TeamListNative({ teams, token, userId, onAddMemberSuccess, onSelectSprint, theme }: TeamListProps) {
  return (
    <View style={nativeStyles.teamsList}>
      <ThemedText type="subtitle" style={nativeStyles.sectionHeader}>
        הצוותים שלי
      </ThemedText>
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
              theme={theme}
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
          />
        );
      })}
    </View>
  );
}
