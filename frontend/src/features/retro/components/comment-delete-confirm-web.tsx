import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button } from '@/components/ui';

interface CommentDeleteConfirmWebProps {
  /** Moderation = an admin deleting someone else's comment. */
  isModeration: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Feature 13 §13.2 — the inline "are you sure" under a comment (never the browser's confirm()).
 * It is not a modal dialog (nothing is trapped or inert), so it is a labelled live group rather than an
 * alertdialog: the question is announced when it appears, focus lands on the confirm button and Esc cancels.
 */
export function CommentDeleteConfirmWeb({ isModeration, busy, error, onConfirm, onCancel }: CommentDeleteConfirmWebProps) {
  const t = useTheme();
  return (
    <Box
      role="group"
      aria-live="polite"
      aria-label={Strings.retroBoard.deleteConfirmText}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape' && !busy) onCancel();
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${t.space[2]}px`,
        borderTop: `1px solid ${t.color.border}`,
        paddingTop: `${t.space[3]}px`,
        marginTop: `${t.space[1]}px`,
      }}
    >
      <Typography sx={{ ...t.type.bodyStrong, color: t.color.status.danger.fg }}>{Strings.retroBoard.deleteConfirmText}</Typography>
      {isModeration ? <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{Strings.retroBoard.deleteModerationHint}</Typography> : null}
      {error ? <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert> : null}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
        <Button variant="danger" size="sm" icon="trash" onPress={onConfirm} disabled={busy} loading={busy} autoFocus>
          {Strings.retroBoard.deleteConfirmButton}
        </Button>
        <Button variant="ghost" size="sm" onPress={onCancel} disabled={busy}>
          {Strings.retroBoard.deleteCancelButton}
        </Button>
      </Box>
    </Box>
  );
}
