import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Card } from '@/components/ui';
import { useMyFocusTasks } from '../hooks/use-my-focus-tasks';
import { formatDueDate } from './format-due';

const S = Strings.focusPoints;

/** Dashboard card: my open tasks from improvement points. Renders nothing when I have none. */
export function MyFocusTasksCardWeb({ token, refreshKey }: { token: string | null | undefined; refreshKey: number }) {
  const t = useTheme();
  const { items, loadError } = useMyFocusTasks(token, refreshKey);
  if (items.length === 0 && !loadError) return null;
  return (
    <Card>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{S.myTasksTitle}</Typography>
        {items.length > 0 ? <Badge tone="accent">{String(items.length)}</Badge> : null}
      </Box>
      {loadError ? (
        <Typography sx={{ ...t.type.caption, color: t.color.status.danger.fg }}>{loadError}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
          {items.map((task) => (
            <Box key={task.id} data-testid="my-focus-task" sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, padding: `${t.space[3]}px`, border: `1px solid ${t.color.border}`, borderRadius: `${t.radius.field}px`, backgroundColor: t.color.surface }}>
              <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, overflowWrap: 'anywhere' }}>{task.title}</Typography>
              <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                {task.focusPoint ? <bdi>{task.focusPoint.team.name}</bdi> : null}
                {task.dueDate ? <> · {S.taskDue} <bdi>{formatDueDate(task.dueDate)}</bdi></> : null}
              </Typography>
              {task.focusPoint ? <Typography sx={{ ...t.type.caption, color: t.color.textMuted, overflowWrap: 'anywhere' }}>{task.focusPoint.text}</Typography> : null}
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}
