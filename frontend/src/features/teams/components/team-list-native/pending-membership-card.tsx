import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { nativeStyles } from './styles';
import type { TeamListTheme } from '@/features/teams/types';

interface PendingMembershipCardProps {
  team: any;
  token: string;
  onResolved: () => void;
  theme: TeamListTheme;
}

// Shown instead of the full team card when the current user has a PENDING invite to join —
// they aren't an active member yet, so they only get an accept/decline choice, not the full
// member list / sprints / admin tools.
export function PendingMembershipCard({ team, token, onResolved, theme }: PendingMembershipCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = async (action: 'accept' | 'decline') => {
    setError(null);
    setLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/members/${team.myMembershipId}/${action}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onResolved();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.dashboard.teamActionFailedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[nativeStyles.infoSection, { backgroundColor: theme.backgroundElement, borderWidth: 2, borderColor: '#6366f1' }]}>
      <ThemedText type="subtitle" style={{ fontWeight: 'bold', textAlign: 'right' }}>
        {team.name}
      </ThemedText>
      <ThemedText type="default" style={{ textAlign: 'right', opacity: 0.8 }}>
        {Strings.dashboard.memberInviteText}
      </ThemedText>
      {!!error && (
        <View style={nativeStyles.errorBannerInline}>
          <ThemedText style={nativeStyles.errorTextInline}>{error}</ThemedText>
        </View>
      )}
      <View style={{ flexDirection: 'row-reverse', gap: Spacing.two }}>
        <TouchableOpacity
          style={[nativeStyles.actionSaveBtn, { backgroundColor: '#6366f1' }]}
          onPress={() => respond('accept')}
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
