import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Segmented } from '@/components/ui';
import { ActionItemMetaWeb } from './action-item-meta-web';
import { STATUS_LABELS } from '../action-items-logic';
import type { ActionItem, ActionItemStatus } from '../types';

interface ActionItemRowWebProps {
  item: ActionItem;
  disabled?: boolean;
  onSetStatus: (status: ActionItemStatus) => void;
  onEdit: () => void;
  onRemove: () => void;
}

const STATUS_OPTIONS = (['OPEN', 'DONE', 'DROPPED'] as const).map((value) => ({ value, label: STATUS_LABELS[value] }));

/** One task in the sprint's panel: status switch, owners, due date, edit and (confirmed) delete. */
export function ActionItemRowWeb({ item, disabled, onSetStatus, onEdit, onRemove }: ActionItemRowWebProps) {
  const t = useTheme();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isClosed = item.status !== 'OPEN';

  return (
    <Box
      data-testid="action-item-row"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${t.space[2]}px`,
        padding: `${t.space[3]}px`,
        border: `1px solid ${t.color.border}`,
        borderRadius: `${t.radius.field}px`,
        backgroundColor: t.color.surface,
        opacity: isClosed ? 0.7 : 1,
      }}
    >
      <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, textDecoration: item.status === 'DONE' ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>
        {item.title}
      </Typography>
      <ActionItemMetaWeb item={item} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
        <Segmented value={item.status} onChange={onSetStatus} options={STATUS_OPTIONS} />
        {isConfirmingDelete ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[1]}px` }}>
            <Typography sx={{ ...t.type.caption, color: t.color.status.danger.fg }}>{Strings.actionItems.deleteConfirmText}</Typography>
            <Button variant="danger" size="sm" disabled={disabled} onPress={onRemove}>{Strings.actionItems.deleteConfirmButton}</Button>
            <Button variant="ghost" size="sm" onPress={() => setIsConfirmingDelete(false)}>{Strings.actionItems.deleteCancelButton}</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[1]}px` }}>
            <Button variant="ghost" size="sm" icon="edit" disabled={disabled} onPress={onEdit}>{Strings.actionItems.editButton}</Button>
            <Button variant="ghost" size="sm" icon="trash" disabled={disabled} onPress={() => setIsConfirmingDelete(true)}>{Strings.actionItems.deleteButton}</Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
