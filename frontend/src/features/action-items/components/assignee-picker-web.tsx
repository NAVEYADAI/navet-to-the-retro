import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Strings } from '@/constants/strings';
import type { AssigneeOption } from '../types';

interface AssigneePickerWebProps {
  options: AssigneeOption[];
  selectedIds: number[];
  onToggle: (userId: number) => void;
  /** Someone already assigned who has since left: kept visible so the edit doesn't silently drop them. */
  extraSelected?: AssigneeOption[];
}

/** Multi-select as a wrapping row of filter-style pills (a selected pill takes the accent tint). */
export function AssigneePickerWeb({ options, selectedIds, onToggle, extraSelected = [] }: AssigneePickerWebProps) {
  const t = useTheme();
  const all = [...options, ...extraSelected.filter((e) => !options.some((o) => o.userId === e.userId))];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px` }}>
      <Typography component="label" sx={{ ...t.type.label, color: t.color.textSecondary }}>
        {Strings.actionItems.assigneesLabel}
      </Typography>
      <Box role="group" aria-label={Strings.actionItems.assigneesLabel} sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
        {all.map((option) => {
          const selected = selectedIds.includes(option.userId);
          return (
            <Box
              key={option.userId}
              component="button"
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(option.userId)}
              sx={{
                ...t.type.caption,
                fontWeight: 600,
                minHeight: 32,
                paddingInline: `${t.space[3]}px`,
                borderRadius: `${t.radius.pill}px`,
                cursor: 'pointer',
                color: selected ? t.color.accent.base : t.color.text,
                backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
                border: `1px solid ${selected ? t.color.accent.base : t.color.borderStrong}`,
                transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}`,
                '&:hover': { backgroundColor: selected ? t.color.accent.subtle : t.color.surfaceHover },
              }}
            >
              <bdi>{option.label}</bdi>
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{Strings.actionItems.assigneesHint}</Typography>
    </Box>
  );
}
