import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button } from '@/components/ui';
import { formatDateRange } from '@/lib/format-date';
import { useDeletedSprints } from '../hooks/use-deleted-sprints';

interface DeletedSprintsSectionProps {
  teamId: number;
  token: string;
  /** נקרא אחרי שחזור — רשימת הספרינטים הרגילה נטענת מחדש. */
  onRestored: () => void;
}

/**
 * Feature 14 (product-backlog/14-sprint-and-team-deletion.md §14.2) — "ספרינטים שנמחקו", admins only,
 * at the bottom of a team's sprint list: each row says how many comments come back and how many
 * days are left to restore it.
 */
export function DeletedSprintsSectionWeb({ teamId, token, onRestored }: DeletedSprintsSectionProps) {
  const t = useTheme();
  const d = useDeletedSprints({ teamId, token, onRestored });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
      <Box>
        <Button variant="ghost" size="sm" icon={d.isOpen ? 'x' : 'trash'} onPress={d.toggle}>
          {d.isOpen ? Strings.sprintDeletion.hideDeletedButton : Strings.sprintDeletion.deletedSectionTitle}
        </Button>
      </Box>

      {d.isOpen && (
        <Box data-testid="deleted-sprints" sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
          {d.error && <Alert severity="error" sx={{ ...t.type.body }}>{d.error}</Alert>}

          {d.isLoading ? (
            <CircularProgress size={20} sx={{ alignSelf: 'center', color: t.color.accent.base }} />
          ) : d.items.length === 0 ? (
            !d.error && <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{Strings.sprintDeletion.noDeleted}</Typography>
          ) : (
            <Box component="ul" sx={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {d.items.map((sprint) => (
                <Box
                  component="li"
                  key={sprint.id}
                  data-testid="deleted-sprint-row"
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: `${t.space[2]}px`,
                    paddingBlock: `${t.space[2]}px`,
                    borderBlockEnd: `1px solid ${t.color.border}`,
                    opacity: 0.85,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 160px' }}>
                    <Typography sx={{ ...t.type.rowTitle, color: t.color.text, overflowWrap: 'anywhere' }}>{sprint.name}</Typography>
                    <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                      <bdi>{formatDateRange(sprint.startDate, sprint.endDate)}</bdi>
                      {' · '}
                      {Strings.sprintDeletion.commentCount(sprint.commentCount)}
                      {' · '}
                      {Strings.sprintDeletion.daysLeft(sprint.daysLeft)}
                    </Typography>
                  </Box>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="refresh"
                    onPress={() => d.restore(sprint)}
                    disabled={d.restoringId !== null}
                    loading={d.restoringId === sprint.id}
                  >
                    {Strings.sprintDeletion.restoreButton}
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
