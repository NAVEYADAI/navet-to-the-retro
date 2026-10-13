import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { TeamLogo } from './team-logo';
import type { TeamBannerProps } from './team-banner';

export type { TeamBannerProps } from './team-banner';

/** גרסת native של `TeamBanner` — אותו API. */
export function TeamBanner({ teamId, teamName, logoUpdatedAt, hasTeamColor, label, inviteToken }: TeamBannerProps) {
  const t = useTheme();
  if (!logoUpdatedAt) return null;
  return (
    <View
      testID="team-banner"
      style={{
        overflow: 'hidden',
        backgroundColor: hasTeamColor ? t.color.accent.subtle : t.color.surface,
        borderBottomWidth: 1,
        borderBottomColor: hasTeamColor ? t.color.accent.border : t.color.border,
      }}
    >
      <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="xl" watermark inviteToken={inviteToken} />
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[3], paddingVertical: t.space[3], paddingHorizontal: t.space[4] }}>
        <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="lg" inviteToken={inviteToken} />
        <Text style={{ flexShrink: 1, fontSize: t.type.cardTitle.fontSize, fontWeight: '600', color: t.color.text, textAlign: 'right' }}>{label ?? teamName}</Text>
      </View>
    </View>
  );
}
