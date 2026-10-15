import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card } from '@/components/ui';
import type { Proposal } from '../types';

const S = Strings.focusPoints;

interface ProposalsCardWebProps {
  proposals: Proposal[];
  disabled: boolean;
  onCreate: (proposal: Proposal) => void;
  onDismiss: (proposal: Proposal) => void;
}

/** Pending "הצע כנקודה" suggestions, most-proposed first. Only HOW MANY proposed is shown, never who. */
export function ProposalsCardWeb({ proposals, disabled, onCreate, onDismiss }: ProposalsCardWebProps) {
  const t = useTheme();
  return (
    <Card>
      <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{S.proposalsTitle}</Typography>
      {proposals.length === 0 ? (
        <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{S.proposalsEmpty}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
          {proposals.map((p) => (
            <Box
              key={p.commentId}
              data-testid="focus-point-proposal"
              sx={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px`,
                padding: `${t.space[3]}px`, border: `1px solid ${t.color.border}`, borderRadius: `${t.radius.field}px`, backgroundColor: t.color.surface,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, minWidth: 0, flex: '1 1 240px' }}>
                <Typography sx={{ ...t.type.body, color: t.color.text, overflowWrap: 'anywhere' }}>{p.content}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
                  <Badge tone="accent">{S.proposerCount(p.proposerCount)}</Badge>
                  <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{S.sourceCommentOf(p.sprintName)}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[1]}px` }}>
                <Button variant="secondary" size="sm" icon="plus" disabled={disabled} onPress={() => onCreate(p)}>{S.createFromProposal}</Button>
                <Button variant="ghost" size="sm" icon="x" disabled={disabled} onPress={() => onDismiss(p)}>{S.dismissProposal}</Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}
