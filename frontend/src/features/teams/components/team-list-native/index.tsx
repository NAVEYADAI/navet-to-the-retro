import React from 'react';
import { View, Text } from 'react-native';
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

export function TeamListNative({ teams, token, userId, onAddMemberSuccess, onSelectSprint }: TeamListProps) {
  const t = useTheme();

  return (
    <View style={{ gap: t.space[4] }}>
      <Text
        style={{
          fontSize: t.type.sectionTitle.fontSize,
          lineHeight: Math.round(t.type.sectionTitle.fontSize * t.type.sectionTitle.lineHeight),
          fontWeight: String(t.type.sectionTitle.fontWeight) as any,
          color: t.color.text,
          textAlign: 'right',
        }}
      >
        {Strings.teamList.myTeamsHeader}
      </Text>
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
    </View>
  );
}
