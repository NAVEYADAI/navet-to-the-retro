import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/design/theme-context';
import { avatarColors } from '@/design/tokens';
import { useSessionToken } from '@/context/session-token-context';
import { getBackendUrl } from '@/api/config';
import { inviteLogoUrl, teamLogoPath } from '@/features/teams/team-logo-urls';
import { Strings } from '@/constants/strings';
import { avatarInitial } from './avatar-shared';
import { TEAM_LOGO_MARKER_PX, TEAM_LOGO_PX, TEAM_LOGO_WATERMARK_OPACITY, type TeamLogoProps } from './team-logo-shared';

export type { TeamLogoProps } from './team-logo-shared';

/** גרסת native של `TeamLogo` — אותו API. expo-image שולח את ה-Authorization ישירות ושומר cache לפי ה-URL. */
export function TeamLogo({ teamId, name, logoUpdatedAt, size = 'md', inviteToken, marker, watermark }: TeamLogoProps) {
  const t = useTheme();
  const token = useSessionToken();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [teamId, logoUpdatedAt, inviteToken]);

  const hasLogo = !!logoUpdatedAt && !failed && (!!inviteToken || !!token);
  const px = marker ? TEAM_LOGO_MARKER_PX : TEAM_LOGO_PX[size];
  const radius = px <= 28 ? t.radius.badge : px <= 40 ? t.radius.field : t.radius.card;

  if (marker && !hasLogo) return null;

  if (watermark) {
    if (!hasLogo) return null;
    const wmSource = inviteToken
      ? { uri: inviteLogoUrl(getBackendUrl(), inviteToken, logoUpdatedAt) }
      : { uri: `${getBackendUrl()}${teamLogoPath(teamId, logoUpdatedAt)}`, headers: { Authorization: `Bearer ${token}` } };
    return (
      <Image
        testID="team-logo-watermark"
        source={wmSource}
        contentFit="contain"
        style={{ position: 'absolute', left: -px * 0.6, top: -px * 0.9, width: px * 4, height: px * 4, opacity: TEAM_LOGO_WATERMARK_OPACITY }}
        pointerEvents="none"
      />
    );
  }

  if (hasLogo) {
    const source = inviteToken
      ? { uri: inviteLogoUrl(getBackendUrl(), inviteToken, logoUpdatedAt) }
      : { uri: `${getBackendUrl()}${teamLogoPath(teamId, logoUpdatedAt)}`, headers: { Authorization: `Bearer ${token}` } };
    return (
      <View
        testID="team-logo"
        style={{
          width: px,
          height: px,
          borderRadius: radius,
          backgroundColor: t.color.logoSurface,
          borderWidth: 1,
          borderColor: t.color.accent.border,
          padding: Math.round(px * 0.12),
          overflow: 'hidden',
        }}
      >
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          accessibilityLabel={name ? Strings.teamLogo.logoAlt(name) : undefined}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  const c = avatarColors(t.mode, teamId);
  return (
    <View
      testID="team-logo-fallback"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: px, height: px, borderRadius: radius, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: c.fg, fontSize: px >= 56 ? t.type.sectionTitle.fontSize : t.type.bodyStrong.fontSize, fontWeight: '600' }}>
        {avatarInitial(name)}
      </Text>
    </View>
  );
}
