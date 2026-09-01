import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';

interface CommentCardWebProps {
  comment: {
    id: number;
    content: string;
    type: 'KEEP' | 'IMPROVE';
    category?: string | null;
    isAnonymous: boolean;
    author: { username: string; firstName?: string | null; lastName?: string | null };
    createdAt: string;
  };
  index: number;
}

export function CommentCardWeb({ comment }: CommentCardWebProps) {
  const t = useTheme();
  const isKeep = comment.type === 'KEEP';
  const accent = isKeep ? t.color.status.success : t.color.status.danger;
  const categoryLabel = comment.category ? (Strings.retroBoard.categories as Record<string, string>)[comment.category] : null;
  const authorName = comment.isAnonymous
    ? Strings.retroBoard.anonymousAuthor
    : `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.username;

  return (
    <Box
      sx={{
        backgroundColor: t.color.surface,
        borderInlineStart: `3px solid ${accent.fg}`,
        borderRadius: `${t.radius.card}px`,
        boxShadow: t.shadow.sm,
      }}
    >
      <Box sx={{ padding: `${t.space[4]}px`, display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px`, textAlign: 'start' }}>
        {categoryLabel && (
          <Box
            sx={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              paddingInline: `${t.space[2]}px`,
              paddingBlock: '3px',
              borderRadius: '8px 3px 8px 3px',
              backgroundColor: accent.bg,
              color: accent.fg,
              ...t.type.overline,
            }}
          >
            <Box
              component="svg"
              viewBox="0 0 24 24"
              sx={{ width: 10, height: 10, flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }}
            >
              <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83Z" />
              <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
            </Box>
            {categoryLabel}
          </Box>
        )}

        <Typography sx={{ ...t.type.body, color: t.color.text }}>
          {comment.content}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[1]}px` }}>
          <Typography sx={{ ...t.type.caption, fontWeight: comment.isAnonymous ? 400 : 600, color: t.color.textSecondary }}>
            <bdi>{authorName}</bdi>
          </Typography>
          <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
            <bdi>
              {new Date(comment.createdAt).toLocaleDateString('he-IL')} · {new Date(comment.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </bdi>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
