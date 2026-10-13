import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { TeamLogo } from './team-logo';

export interface TeamBannerProps {
  teamId: number;
  teamName: string;
  logoUpdatedAt?: string | null;
  /** כשיש צבע צוות (פיצ'ר 19) הרצועה נצבעת בו. תמיד בתוך <TeamAccentScope> של הקורא. */
  hasTeamColor: boolean;
  /** טקסט במקום שם הצוות (למשל "הוזמנת להצטרף ל..." בדף ההזמנה). */
  label?: string;
  /** דף ההזמנה: הלוגו נטען לפי טוקן ההזמנה, בלי התחברות (פיצ'ר 19, החלטה #7). */
  inviteToken?: string;
}

/**
 * רצועת זהות הצוות מעל מסכי הספרינט (לוח / סיכום / זיכרון): לוגו + שם צוות + סימן מים.
 * מוצגת רק לצוות עם לוגו — לצוות בלי לוגו המסכים נראים בדיוק כמו לפני פיצ'ר 19.
 */
export function TeamBanner({ teamId, teamName, logoUpdatedAt, hasTeamColor, label, inviteToken }: TeamBannerProps) {
  const t = useTheme();
  if (!logoUpdatedAt) return null;
  return (
    <Box
      data-testid="team-banner"
      data-team-color={hasTeamColor ? 'true' : 'false'}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: hasTeamColor ? t.color.accent.subtle : t.color.surface,
        borderBlockEnd: `1px solid ${hasTeamColor ? t.color.accent.border : t.color.border}`,
      }}
    >
      <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="xl" watermark inviteToken={inviteToken} />
      <Box
        sx={{
          position: 'relative',
          maxWidth: t.layout.container,
          marginInline: 'auto',
          paddingInline: { xs: `${t.space[4]}px`, sm: `${t.layout.pagePaddingInline}px` },
          paddingBlock: `${t.space[3]}px`,
          display: 'flex',
          alignItems: 'center',
          gap: `${t.space[3]}px`,
        }}
      >
        <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="lg" inviteToken={inviteToken} />
        <Typography component="p" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>
          {label ?? teamName}
        </Typography>
      </Box>
    </Box>
  );
}
