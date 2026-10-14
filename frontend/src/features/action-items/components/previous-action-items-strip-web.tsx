import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Card } from '@/components/ui';
import { ActionItemMetaWeb } from './action-item-meta-web';
import type { ActionItem, ActionItemStatus } from '../types';

interface PreviousActionItemsStripWebProps {
  items: ActionItem[];
  disabled?: boolean;
  onSetStatus: (item: ActionItem, status: ActionItemStatus) => void;
}

/** "מה בוצע?" — open tasks from earlier retros, closable in one tap. Rendered only when there are any. */
export function PreviousActionItemsStripWeb({ items, disabled, onSetStatus }: PreviousActionItemsStripWebProps) {
  const t = useTheme();
  return (
    <Card>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
            {Strings.actionItems.previousTitle}
          </Typography>
          <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
            {Strings.actionItems.previousSubtitle} · {Strings.actionItems.previousCount(items.length)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
        {items.map((item) => (
          <Box
            key={item.id}
            data-testid="previous-action-item"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: `${t.space[2]}px`,
              padding: `${t.space[3]}px`,
              border: `1px solid ${t.color.border}`,
              borderRadius: `${t.radius.field}px`,
              backgroundColor: t.color.surface,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, minWidth: 0, flex: '1 1 220px' }}>
              <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, overflowWrap: 'anywhere' }}>{item.title}</Typography>
              <ActionItemMetaWeb item={item} showSprint />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[1]}px` }}>
              <Button variant="secondary" size="sm" icon="check" disabled={disabled} onPress={() => onSetStatus(item, 'DONE')}>
                {Strings.actionItems.markDoneButton}
              </Button>
              <Button variant="ghost" size="sm" icon="x" disabled={disabled} onPress={() => onSetStatus(item, 'DROPPED')}>
                {Strings.actionItems.markDroppedButton}
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
}
