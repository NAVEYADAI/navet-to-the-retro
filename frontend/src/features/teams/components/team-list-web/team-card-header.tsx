import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { TeamAccentScope, useTheme } from '@/design/theme-context';
import { Avatar, Badge, Icon, TeamLogo } from '@/components/ui';
import { memberDisplayName } from '@/features/teams/member-display';
import { GuideAnchor } from '@/components/ui/guide-anchor';

const MAX_STACKED_AVATARS = 4;
/** בטלפון הכפתור יושב לצד השם, אז מציגים פחות אווטרים כדי שיישאר לשם מקום. */
const MAX_STACKED_AVATARS_MOBILE = 2;

interface TeamCardHeaderProps {
  teamId: number;
  /** פיצ'ר 19: לוגו + צבע צוות. null = בלי לוגו / בלי צבע (הכותרת נראית כמו לפני הפיצ'ר). */
  logoUpdatedAt?: string | null;
  accentHue?: number | null;
  teamName: string;
  isTeamAdmin: boolean;
  summary: string;
  members: any[];
  isMembersOpen: boolean;
  onToggleMembers: () => void;
  /** undefined = אין הרשאה להגדרות, אז גלגל השיניים לא מוצג. */
  onToggleSettings?: () => void;
  isSettingsOpen: boolean;
}

/**
 * ראש כרטיס הצוות: שם + תג מנהל + שורת סיכום, ובצד השני (שמאל) כפתור החברים וגלגל ההגדרות.
 * תמיד שורה אחת — גם בטלפון הכפתורים לא יורדים מתחת לשם; השם נשבר בתוך העמודה שלו.
 */
export function TeamCardHeader(props: TeamCardHeaderProps) {
  // הצבע שנגזר מהלוגו חל על הכותרת בלבד ("אזור הצוות") — לא על שאר הכרטיס (פיצ'ר 19, החלטה #4).
  return (
    <TeamAccentScope hue={props.accentHue}>
      <TeamCardHeaderContent {...props} />
    </TeamAccentScope>
  );
}

function TeamCardHeaderContent({
  teamId,
  logoUpdatedAt,
  accentHue,
  teamName,
  isTeamAdmin,
  summary,
  members,
  isMembersOpen,
  onToggleMembers,
  onToggleSettings,
  isSettingsOpen,
}: TeamCardHeaderProps) {
  const t = useTheme();
  const hasTeamColor = accentHue !== null && accentHue !== undefined;

  return (
    <Box
      data-testid="team-card-header"
      data-team-color={hasTeamColor ? 'true' : 'false'}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: hasTeamColor ? t.color.accent.subtle : 'transparent',
        borderBlockEnd: hasTeamColor ? `1px solid ${t.color.accent.border}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: { xs: `${t.space[2]}px`, sm: `${t.space[3]}px` },
        paddingBlock: { xs: `${t.space[4]}px`, sm: `${t.space[4] + 4}px` },
        paddingInline: { xs: `${t.space[4]}px`, sm: `${t.space[5]}px` },
      }}
    >
      {hasTeamColor && <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="lg" watermark />}

      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: `${t.space[3]}px`, flex: '1 1 0', minWidth: 0 }}>
        <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
          <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="lg" />
        </Box>
        <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
          <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="md" />
        </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, flex: '1 1 0', minWidth: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0, overflowWrap: 'anywhere' }}>
            {teamName}
          </Typography>
          {isTeamAdmin && <Badge tone="accent">{Strings.teamList.adminBadge}</Badge>}
        </Box>
        {summary && <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{summary}</Typography>}
      </Box>
      </Box>

      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: { xs: `${t.space[1]}px`, sm: `${t.space[2]}px` }, flexShrink: 0 }}>
        <GuideAnchor name="team-members-toggle">
        <Box
          component="button"
          type="button"
          aria-expanded={isMembersOpen}
          onClick={onToggleMembers}
          sx={{
            ...t.type.bodyStrong,
            display: 'inline-flex',
            alignItems: 'center',
            gap: { xs: '6px', sm: '10px' },
            minHeight: t.layout.minTouchTarget,
            paddingInlineStart: { xs: `${t.space[2]}px`, sm: '14px' },
            paddingInlineEnd: { xs: '10px', sm: `${t.space[3]}px` },
            whiteSpace: 'nowrap',
            color: t.color.text,
            backgroundColor: isMembersOpen ? t.color.accent.subtle : t.color.surface,
            border: `1px solid ${isMembersOpen ? t.color.accent.border : t.color.borderStrong}`,
            borderRadius: `${t.radius.pill}px`,
            cursor: 'pointer',
            transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}`,
            '&:hover': { backgroundColor: isMembersOpen ? t.color.accent.subtle : t.color.surfaceSubtle },
            '&:focus-visible': { outline: `2px solid ${t.color.accent.border}`, outlineOffset: 1 },
          }}
        >
          {members.length > 0 && (
            <Box component="span" sx={{ display: 'inline-flex', '& > *': { marginInlineEnd: '-6px' } }}>
              {members.slice(0, MAX_STACKED_AVATARS).map((m, i) => (
                <Box key={m.id} component="span" sx={{ display: i < MAX_STACKED_AVATARS_MOBILE ? 'inline-flex' : { xs: 'none', sm: 'inline-flex' } }}>
                  <Avatar name={memberDisplayName(m)} seed={m.id} size="sm" />
                </Box>
              ))}
            </Box>
          )}
          <Box component="span" sx={{ marginInlineStart: { xs: '4px', sm: '6px' } }}>
            {Strings.teamList.membersToggleLabel(members.length)}
          </Box>
          <Icon name="chevron-down" size="sm" rotate={isMembersOpen ? 180 : 0} />
        </Box>
        </GuideAnchor>

        {onToggleSettings && (
          <Box
            component="button"
            type="button"
            aria-label={Strings.teamSettingsPanel.title}
            aria-expanded={isSettingsOpen}
            onClick={onToggleSettings}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: t.layout.minTouchTarget,
              height: t.layout.minTouchTarget,
              backgroundColor: isSettingsOpen ? t.color.accent.subtle : 'transparent',
              border: `1px solid ${isSettingsOpen ? t.color.accent.border : 'transparent'}`,
              borderRadius: `${t.radius.field}px`,
              cursor: 'pointer',
              transition: `background-color ${t.motion.fast}`,
              '&:hover': { backgroundColor: isSettingsOpen ? t.color.accent.subtle : t.color.surfaceSubtle },
              '&:focus-visible': { outline: `2px solid ${t.color.accent.border}`, outlineOffset: 1 },
            }}
          >
            <Icon name="settings" size="md" tone={isSettingsOpen ? 'accent' : 'muted'} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
