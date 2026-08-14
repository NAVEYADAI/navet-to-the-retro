import React from 'react';
import { Card, CardContent, Typography, Box, Grow } from '@mui/material';
import { Strings } from '@/constants/strings';

interface CommentCardWebProps {
  comment: {
    id: number;
    content: string;
    type: 'KEEP' | 'IMPROVE';
    isAnonymous: boolean;
    author: { username: string };
    createdAt: string;
  };
  index: number;
  isDark: boolean;
  isAdmin: boolean;
}

export function CommentCardWeb({ comment, index, isDark, isAdmin }: CommentCardWebProps) {
  const isKeep = comment.type === 'KEEP';

  const cardBg = isKeep
    ? isDark ? 'rgba(16,185,129,0.08)' : '#ecfdf5'
    : isDark ? 'rgba(255,23,68,0.08)' : '#fff1f2';

  const borderColor = isKeep ? '#10b981' : '#ff1744';
  const textColor = isKeep
    ? isDark ? '#a7f3d0' : '#065f46'
    : isDark ? '#fecdd3' : '#9f1239';

  const authorColor = isKeep
    ? isDark ? '#34d399' : '#047857'
    : isDark ? '#fda4af' : '#be123c';

  const timeColor = isKeep
    ? isDark ? '#6ee7b7' : '#047857'
    : isDark ? '#fecdd3' : '#be123c';

  return (
    <Grow in={true} timeout={(index % 8) * 100 + 300}>
      <Card sx={{
        backgroundColor: cardBg,
        borderRight: `5px solid ${borderColor}`,
        borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
        borderRadius: '16px',
        boxShadow: '0px 4px 12px rgba(0,0,0,0.04)',
      }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.5, textAlign: 'right' }}>
          <Typography sx={{ color: textColor, fontWeight: '500', lineHeight: 1.5, fontFamily: 'Rubik, sans-serif', fontSize: 14 }}>
            {comment.content}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', pt: 1, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
            {comment.isAnonymous ? (
              <Typography sx={{ fontSize: 11, fontWeight: 'bold', fontStyle: 'italic', color: '#f59e0b', fontFamily: 'Rubik, sans-serif' }}>
                {comment.author.username !== 'Anonymous' && isAdmin
                  ? Strings.retroBoard.anonymousByAdmin(comment.author.username)
                  : Strings.retroBoard.anonymousAuthor}
              </Typography>
            ) : (
              <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: authorColor, fontFamily: 'Rubik, sans-serif' }}>
                @{comment.author.username}
              </Typography>
            )}
            <Typography sx={{ fontSize: 11, color: timeColor, opacity: 0.7, fontFamily: 'Rubik, sans-serif' }}>
              {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );
}
