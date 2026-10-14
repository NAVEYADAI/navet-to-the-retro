import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge } from '@/components/ui';
import { assigneeName, formatDueDate, isOverdue } from '../action-items-logic';
import type { ActionItem } from '../types';

/** Owners + due date line shared by every action-item row (panel, previous strip, dashboard). */
export function ActionItemMetaWeb({ item, showSprint }: { item: ActionItem; showSprint?: boolean }) {
  const t = useTheme();
  const caption = { ...t.type.caption, color: t.color.textSecondary };
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[1]}px ${t.space[3]}px` }}>
      {item.assignees.length === 0 ? (
        <Typography sx={caption}>{Strings.actionItems.assigneesTeam}</Typography>
      ) : (
        item.assignees.map((a) => (
          <Box key={a.userId} sx={{ display: 'inline-flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
            <Typography sx={{ ...caption, fontWeight: 600 }}><bdi>{assigneeName(a)}</bdi></Typography>
            {!a.isActiveMember && <Badge tone="neutral">{Strings.actionItems.notInTeam}</Badge>}
          </Box>
        ))
      )}
      {item.dueDate ? (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
          <Typography sx={caption}>{Strings.actionItems.dueLabel}: <bdi>{formatDueDate(item.dueDate)}</bdi></Typography>
          {isOverdue(item) && <Badge tone="danger">{Strings.actionItems.overdueBadge}</Badge>}
        </Box>
      ) : null}
      {showSprint ? <Typography sx={{ ...caption, color: t.color.textMuted }}>{Strings.actionItems.bornInSprint(item.sprint.name)}</Typography> : null}
    </Box>
  );
}
