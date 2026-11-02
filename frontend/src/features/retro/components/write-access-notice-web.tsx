import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Card, Icon } from '@/components/ui';
import { formatDate } from '@/lib/format-date';
import type { WriteAccess } from '../comment-types';

/**
 * Feature 13 §13.2 — shown instead of the compose form when the board is locked for writing, and
 * above it ("פתוח לך עד …") when the window is closed but an admin extended it for this user.
 * Returns null when there is nothing to say (window open, or access unknown).
 */
export function WriteAccessNoticeWeb({ access }: { access: WriteAccess | null }) {
  const t = useTheme();
  if (!access) return null;

  if (!access.canWrite) {
    return (
      <div data-testid="write-locked-notice">
        <Card>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[2]}px` }}>
            <Icon name="lock" tone="muted" />
            <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
              {Strings.retroBoard.writeLockedTitle}
            </Typography>
          </Box>
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
            {Strings.retroBoard.writeLockedBody(access.windowDays)}
          </Typography>
        </Card>
      </div>
    );
  }

  if (!access.windowOpen && access.extensionExpiresAt) {
    return (
      <Box
        data-testid="write-extension-notice"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${t.space[1]}px`,
          padding: `${t.space[3]}px ${t.space[4]}px`,
          backgroundColor: t.color.accent.subtle,
          border: `1px solid ${t.color.accent.border}`,
          borderRadius: `${t.radius.card}px`,
        }}
      >
        <Typography sx={{ ...t.type.bodyStrong, color: t.color.accent.base }}>
          {Strings.retroBoard.writeOpenUntil(formatDate(access.extensionExpiresAt))}
        </Typography>
        <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{Strings.retroBoard.writeOpenUntilHint}</Typography>
      </Box>
    );
  }

  return null;
}
