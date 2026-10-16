import React, { useState } from 'react';
import { Box } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon, Collapse, type IconName } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';

export interface SprintNavAction {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

/**
 * יעדי הספרינט (סיכום / נקודות לשיפור / משחק זיכרון / ...) מאחורי שורת "כלי ספרינט · N" מתקפלת.
 * סגורה כברירת מחדל — הלוח וכתיבת ההערה נשארים במרכז; כשיתווספו יעדים השורה הסגורה לא גדלה.
 * הרשת עוטפת שורות (3 בטלפון, אריחים בני ~170px בדסקטופ), עם האייקון מעל התווית בטלפון.
 */
export function SprintNavActionsWeb({ actions }: { actions: SprintNavAction[] }) {
  const t = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  if (actions.length === 0) return null;
  return (
    <Box>
      <Box
        component="button"
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          trackEvent('sprint_tools_toggled', { open: !isOpen });
          setIsOpen(!isOpen);
        }}
        sx={{
          ...t.type.label,
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${t.space[2]}px`,
          minHeight: t.layout.minTouchTarget,
          paddingInline: `${t.space[2]}px`,
          color: t.color.textSecondary,
          backgroundColor: 'transparent',
          border: 0,
          borderRadius: `${t.radius.field}px`,
          cursor: 'pointer',
          transition: `background-color ${t.motion.fast}`,
          '&:hover': { backgroundColor: t.color.surfaceSubtle },
          '&:focus-visible': { outline: `2px solid ${t.color.accent.border}`, outlineOffset: 1 },
        }}
      >
        <Icon name="chevron-down" size="sm" tone="muted" rotate={isOpen ? 180 : 0} />
        {Strings.retroBoard.toolsToggle(actions.length)}
      </Box>
      <Collapse open={isOpen}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(170px, 1fr))' },
            gap: { xs: `${t.space[2]}px`, sm: `${t.space[3]}px` },
            paddingBlockStart: `${t.space[1]}px`,
          }}
        >
          {actions.map((action) => (
            <Box
              key={action.key}
              component="button"
              type="button"
              onClick={action.onPress}
              sx={{
                ...t.type.label,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: 'center',
                justifyContent: 'center',
                gap: { xs: `${t.space[1]}px`, sm: `${t.space[2]}px` },
                minHeight: t.layout.minTouchTarget,
                paddingBlock: { xs: `${t.space[2]}px`, sm: 0 },
                paddingInline: `${t.space[2]}px`,
                minWidth: 0,
                textAlign: 'center',
                color: t.color.text,
                backgroundColor: t.color.surface,
                border: `1px solid ${t.color.border}`,
                borderRadius: `${t.radius.field}px`,
                cursor: 'pointer',
                transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}`,
                '&:hover': { backgroundColor: t.color.surfaceSubtle, borderColor: t.color.borderStrong },
                '&:focus-visible': { outline: `2px solid ${t.color.accent.border}`, outlineOffset: 1 },
              }}
            >
              <Icon name={action.icon} size="sm" tone="muted" />
              <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{action.label}</Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
