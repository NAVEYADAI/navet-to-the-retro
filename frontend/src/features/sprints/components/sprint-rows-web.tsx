import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { formatDateCompact } from '@/lib/format-date';
import { daysUntilStart, getSprintProgress } from '../sprint-lifecycle';

/**
 * שורות רשימת הספרינטים בכרטיס הצוות, לפי המוקאפ: שם+תאריכים, התקדמות/תג, וקישור ללוח.
 * הכל בשורה אחת בכל רוחב — במובייל הרכיבים מצטמצמים (השם נשבר בתוך העמודה שלו) ולא יורדים שורה.
 */

function useRowSx(muted = false) {
  const t = useTheme();
  return {
    display: 'flex',
    alignItems: 'center',
    gap: { xs: `${t.space[2]}px`, sm: `${t.space[4]}px` },
    paddingBlock: `${t.space[3]}px`,
    borderBlockEnd: `1px solid ${t.color.border}`,
    cursor: 'pointer',
    opacity: muted ? 0.72 : 1,
    '&:hover .sprint-row-name': { color: t.color.accent.base },
  } as const;
}

function SprintDates({ sprint }: { sprint: any }) {
  const t = useTheme();
  return (
    <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
      <bdi>{formatDateCompact(sprint.startDate)}</bdi>
      {' – '}
      <bdi>{formatDateCompact(sprint.endDate)}</bdi>
    </Typography>
  );
}

function SprintTitle({ sprint }: { sprint: any }) {
  const t = useTheme();
  return (
    // בטלפון הבסיס הוא אורך השם (לא 0), כך שהשטח הפנוי מתחלק בינו לבין פס ההתקדמות ולא נבלע כולו בשם.
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: { xs: '1 1 auto', sm: '1 1 0' }, minWidth: 0 }}>
      <Typography className="sprint-row-name" sx={{ ...t.type.rowTitle, color: t.color.text, overflowWrap: 'anywhere', transition: `color ${t.motion.fast}` }}>
        {sprint.name}
      </Typography>
      <SprintDates sprint={sprint} />
    </Box>
  );
}

function EnterLink() {
  const t = useTheme();
  return (
    <Typography sx={{ ...t.type.bodyStrong, color: t.color.accent.base, display: 'inline-flex', alignItems: 'center', minHeight: t.layout.minTouchTarget, whiteSpace: 'nowrap' }}>
      {Strings.sprints.enterRetroButton}
    </Typography>
  );
}

/** תג + קישור תמיד יחד, בקצה השורה, בלי להתכווץ. */
function RowEnd({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: `${t.space[2]}px`, sm: `${t.space[4]}px` }, flexShrink: 0, whiteSpace: 'nowrap' }}>
      {children}
    </Box>
  );
}

function SprintProgress({ sprint }: { sprint: any }) {
  const t = useTheme();
  const { day, total, percent } = getSprintProgress(sprint.startDate, sprint.endDate);
  return (
    // בטלפון הפס גדל לתוך השטח הפנוי (עד 140) ומרוחק מ"כניסה ללוח", כדי שלא ייראה דבוק לקצה השמאלי.
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, flex: { xs: '1 1 84px', sm: '0 1 200px' }, minWidth: 84, maxWidth: { xs: 140, sm: 'none' }, marginInlineEnd: { xs: `${t.space[2]}px`, sm: 0 } }}>
      <Box
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={Strings.sprints.progressText(day, total)}
        sx={{ height: 6, borderRadius: `${t.radius.pill}px`, backgroundColor: t.color.border, overflow: 'hidden' }}
      >
        <Box sx={{ height: '100%', width: `${percent}%`, borderRadius: `${t.radius.pill}px`, backgroundColor: t.color.status.success.fg }} />
      </Box>
      <Typography sx={{ ...t.type.caption, color: t.color.textSecondary, whiteSpace: 'nowrap' }}>{Strings.sprints.progressText(day, total)}</Typography>
    </Box>
  );
}

export function OpenSprintRow({ sprint, state, onPress }: { sprint: any; state: 'active' | 'upcoming'; onPress: () => void }) {
  const rowSx = useRowSx();
  return (
    <Box data-testid="open-sprint-row" onClick={onPress} sx={rowSx}>
      <SprintTitle sprint={sprint} />
      {state === 'active' && <SprintProgress sprint={sprint} />}
      <RowEnd>
        {state === 'active'
          // בטלפון פס ההתקדמות כבר אומר "פעיל" — התג מוסתר כדי שהשורה תישאר אחת.
          ? <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><Badge tone="success">{Strings.sprints.activeBadge}</Badge></Box>
          : <Badge tone="warning">{Strings.sprints.startsInBadge(daysUntilStart(sprint.startDate))}</Badge>}
        <EnterLink />
      </RowEnd>
    </Box>
  );
}

export function RecentSprintsGroup({ sprints, onSelect }: { sprints: any[]; onSelect: (sprint: any) => void }) {
  const t = useTheme();
  const rowSx = useRowSx(true);
  return (
    <>
      <Typography sx={{ ...t.type.overline, color: t.color.textMuted, textTransform: 'uppercase', paddingBlockStart: `${t.space[4]}px`, paddingBlockEnd: `${t.space[1]}px` }}>
        {Strings.sprints.recentHeader}
      </Typography>
      {sprints.map((sprint) => (
        <Box key={sprint.id} data-testid="recent-sprint-row" onClick={() => onSelect(sprint)} sx={rowSx}>
          <SprintTitle sprint={sprint} />
          <RowEnd>
            <Badge tone="neutral">{Strings.sprints.endedBadge}</Badge>
            <EnterLink />
          </RowEnd>
        </Box>
      ))}
    </>
  );
}

export function ExpiredSprintsGroup({ sprints, onSelect }: { sprints: any[]; onSelect: (sprint: any) => void }) {
  const t = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Box
        component="button"
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          trackEvent('sprint_expired_toggled', { open: !isOpen });
          setIsOpen(!isOpen);
        }}
        sx={{
          ...t.type.label,
          display: 'flex',
          alignItems: 'center',
          gap: `${t.space[2]}px`,
          width: '100%',
          minHeight: t.layout.minTouchTarget,
          marginBlock: `${t.space[2]}px`,
          paddingInline: `${t.space[2]}px`,
          color: t.color.textSecondary,
          backgroundColor: 'transparent',
          border: 0,
          borderRadius: `${t.radius.field}px`,
          textAlign: 'start',
          cursor: 'pointer',
          transition: `background-color ${t.motion.fast}`,
          '&:hover': { backgroundColor: t.color.surfaceSubtle },
        }}
      >
        <Icon name="chevron-down" size="sm" tone="muted" rotate={isOpen ? 180 : 0} />
        {Strings.sprints.expiredHeader(sprints.length)}
      </Box>
      {isOpen && (
        <Box sx={{ paddingInline: `${t.space[2]}px`, paddingBlockEnd: `${t.space[3]}px` }}>
          {sprints.map((sprint) => (
            <Box
              key={sprint.id}
              onClick={() => onSelect(sprint)}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: `${t.space[3]}px`,
                paddingBlock: '10px',
                borderBlockEnd: `1px solid ${t.color.border}`,
                opacity: 0.72,
                cursor: 'pointer',
                '&:hover p:first-of-type': { color: t.color.accent.base },
              }}
            >
              <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, minWidth: 0 }}>{sprint.name}</Typography>
              <SprintDates sprint={sprint} />
            </Box>
          ))}
        </Box>
      )}
    </>
  );
}
