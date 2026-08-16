import React from 'react';
import { Card, CardContent, Typography, Box, Grow } from '@mui/material';
import { Strings } from '@/constants/strings';

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
  theme: {
    text: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function CommentCardWeb({ comment, index, theme }: CommentCardWebProps) {
  const isKeep = comment.type === 'KEEP';
  const accentColor = isKeep ? '#10b981' : '#ef4444';
  const categoryLabel = comment.category ? (Strings.retroBoard.categories as Record<string, string>)[comment.category] : null;

  return (
    <Grow in={true} timeout={200}>
      <Card sx={{
        backgroundColor: theme.backgroundElement,
        borderRight: `3px solid ${accentColor}`,
        borderRadius: '10px',
        boxShadow: '0px 1px 3px rgba(0,0,0,0.06)',
      }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right' }}>
          {categoryLabel && (
            <Box
              sx={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.1,
                py: 0.3,
                borderRadius: '8px 3px 8px 3px',
                backgroundColor: `${accentColor}18`,
                color: accentColor,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'Rubik, sans-serif',
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

          <Typography sx={{ color: theme.text, lineHeight: 1.5, fontFamily: 'Rubik, sans-serif', fontSize: 14 }}>
            {comment.content}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
            {comment.isAnonymous ? (
              <Typography sx={{ fontSize: 11, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                🥸 {Strings.retroBoard.anonymousAuthor}
              </Typography>
            ) : (
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                {`${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.username}
              </Typography>
            )}
            <Typography sx={{ fontSize: 11, color: theme.textSecondary, opacity: 0.6, fontFamily: 'Rubik, sans-serif' }}>
              {new Date(comment.createdAt).toLocaleDateString('he-IL')} · {new Date(comment.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );
}
