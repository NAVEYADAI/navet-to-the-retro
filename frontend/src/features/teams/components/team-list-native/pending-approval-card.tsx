import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';

interface PendingApprovalCardProps {
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

// Shown to the designated approver while the team they were asked to approve is still
// PENDING_APPROVAL — approve/decline the team's creation itself.
export function PendingApprovalCard({ team, token, onResolved }: PendingApprovalCardProps) {
  const t = useTheme();
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
    <View
      style={{
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.border,
        borderRadius: t.radius.card,
        padding: t.space[5],
        gap: t.space[4],
      }}
    >
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: t.space[3] }}>
        <Text style={[rnText(t.type.cardTitle), { color: t.color.text }]}>
          {team.name}
        </Text>
        <View
          style={{
            backgroundColor: t.color.accent.subtle,
            borderWidth: 1,
            borderColor: t.color.accent.border,
            borderRadius: t.radius.badge,
            paddingHorizontal: t.space[2] + 1,
            paddingVertical: 3,
          }}
        >
          <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.accent.base }]}>
            ממתין לאישורך
          </Text>
        </View>
      </View>
      <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>
        {Strings.dashboard.approvalInviteText(creatorName)}
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
      <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
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
          onPress={() => respond('approve')}
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
