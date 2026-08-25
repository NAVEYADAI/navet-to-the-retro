import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { nativeStyles } from './styles';
import type { TeamListTheme } from '@/features/teams/types';

interface PendingApprovalCardProps {
  team: any;
  token: string;
  onResolved: () => void;
  theme: TeamListTheme;
}

// Shown to the designated approver while the team they were asked to approve is still
// PENDING_APPROVAL — approve/decline the team's creation itself.
export function PendingApprovalCard({ team, token, onResolved, theme }: PendingApprovalCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = async (action: 'approve' | 'decline') => {
    setError(null);
    setLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/${action}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onResolved();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.dashboard.teamActionFailedError);
    } finally {
      setLoading(false);
    }
  };

  const creatorMember = team.members?.find((m: any) => m.userId === team.creatorId);
  const creatorName = creatorMember?.user?.firstName || creatorMember?.user?.lastName
    ? `${creatorMember?.user?.firstName || ''} ${creatorMember?.user?.lastName || ''}`.trim()
    : `@${creatorMember?.user?.username || ''}`;

  return (
    <View style={[nativeStyles.infoSection, { backgroundColor: theme.backgroundElement, borderWidth: 2, borderColor: '#6366f1' }]}>
      <ThemedText type="subtitle" style={{ fontWeight: 'bold', textAlign: 'right' }}>
        {team.name}
      </ThemedText>
      <ThemedText type="default" style={{ textAlign: 'right', opacity: 0.8 }}>
        {Strings.dashboard.approvalInviteText(creatorName)}
      </ThemedText>
      {!!error && (
        <View style={nativeStyles.errorBannerInline}>
          <ThemedText style={nativeStyles.errorTextInline}>{error}</ThemedText>
        </View>
      )}
      <View style={{ flexDirection: 'row-reverse', gap: Spacing.two }}>
        <TouchableOpacity
          style={[nativeStyles.actionSaveBtn, { backgroundColor: '#6366f1' }]}
          onPress={() => respond('approve')}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
              {Strings.dashboard.approveTeamButton}
            </ThemedText>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[nativeStyles.actionCancelBtn, { backgroundColor: theme.backgroundSelected }]}
          onPress={() => respond('decline')}
          disabled={loading}
        >
          <ThemedText style={{ fontSize: 13 }}>{Strings.dashboard.declineTeamButton}</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}
