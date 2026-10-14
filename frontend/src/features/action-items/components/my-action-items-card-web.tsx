import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Card } from '@/components/ui';
import { ActionItemMetaWeb } from './action-item-meta-web';
import { useMyActionItems } from '../hooks/use-my-action-items';

/** Dashboard card: my open follow-up tasks across all teams. Renders nothing when I have none. */
export function MyActionItemsCardWeb({ token, refreshKey }: { token: string | null | undefined; refreshKey: number }) {
  const t = useTheme();
  const { items, loadError } = useMyActionItems(token, refreshKey);
  if (items.length === 0 && !loadError) return null;

  return (
    <Card>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
          {Strings.actionItems.myTasksTitle}
        </Typography>
        {items.length > 0 ? <Badge tone="accent">{String(items.length)}</Badge> : null}
      </Box>
      {loadError ? (
        <Typography sx={{ ...t.type.caption, color: t.color.status.danger.fg }}>{loadError}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
          {items.map((item) => (
            <Box
              key={item.id}
              data-testid="my-action-item"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: `${t.space[1]}px`,
                padding: `${t.space[3]}px`,
                border: `1px solid ${t.color.border}`,
                borderRadius: `${t.radius.field}px`,
                backgroundColor: t.color.surface,
              }}
            >
              <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, overflowWrap: 'anywhere' }}>{item.title}</Typography>
              <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}><bdi>{item.team.name}</bdi></Typography>
              <ActionItemMetaWeb item={item} showSprint />
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}
