import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';

interface PendingMembershipCardProps {
  team: any;
  token: string;
  onResolved: () => void;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

// Shown instead of the full team card when the current user has a PENDING invite to join —
// they aren't an active member yet, so they only get an accept/decline choice, not the full
// member list / sprints / admin tools.
export function PendingMembershipCard({ team, token, onResolved }: PendingMembershipCardProps) {
  const t = useTheme();
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
    <View
      style={{
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.accent.border,
        borderRadius: t.radius.card,
        padding: t.space[5],
        gap: t.space[4],
      }}
    >
      <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>
        {team.name}
      </Text>
      <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>
        {Strings.dashboard.memberInviteText}
      </Text>
      {!!error && (
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
            {error}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row-reverse',
            gap: t.space[1],
            backgroundColor: t.color.accent.base,
            borderRadius: t.radius.field,
            minHeight: t.layout.minTouchTarget,
            paddingHorizontal: t.space[4],
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => respond('accept')}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={t.color.accent.onBase} />
          ) : (
            <>
              <Icon name="check" size="sm" tone="inverse" />
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
                {Strings.dashboard.approveTeamButton}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flexDirection: 'row-reverse',
            gap: t.space[1],
            backgroundColor: t.color.surfaceSubtle,
            borderRadius: t.radius.field,
            minHeight: t.layout.minTouchTarget,
            paddingHorizontal: t.space[4],
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => respond('decline')}
          disabled={loading}
        >
          <Icon name="x" size="sm" />
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.text }]}>
            {Strings.dashboard.declineTeamButton}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
