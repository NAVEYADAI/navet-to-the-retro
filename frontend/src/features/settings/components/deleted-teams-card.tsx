import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { Button, Card } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { useDeletedTeams } from '../hooks/use-deleted-teams';

/**
 * Feature 14 (product-backlog/14-sprint-and-team-deletion.md §14.2, technical default #7) — "צוותים
 * שנמחקו" in the settings: the teams the user was an admin of when they were deleted, each with how
 * many days are left to restore it. Restoring brings the team back with all its members, sprints and comments.
 */
export function DeletedTeamsCard() {
  const t = useTheme();
  const { token } = useAuth();
  const d = useDeletedTeams(token);

  return (
    <Card padding={5}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, minWidth: 0, flex: '1 1 200px' }}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{Strings.deletedTeams.cardTitle}</Typography>
          <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{Strings.deletedTeams.cardSubtitle}</Typography>
        </Box>
        <Button
          variant="ghost"
          size="sm"
          icon="refresh"
          iconOnlyOnMobile
          onPress={() => { trackEvent('refresh_clicked', { screen: 'deleted_teams' }); void d.load(); }}
          disabled={d.isLoading}
        >
          {Strings.common.refreshButton}
        </Button>
      </Box>

      {d.error && <Alert severity="error" sx={{ ...t.type.body }}>{d.error}</Alert>}

      {d.isLoading ? (
        <CircularProgress size={20} sx={{ alignSelf: 'center', color: t.color.accent.base }} />
      ) : d.items.length === 0 ? (
        !d.error && <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{Strings.deletedTeams.empty}</Typography>
      ) : (
        <Box component="ul" data-testid="deleted-teams" sx={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {d.items.map((team) => (
            <Box
              component="li"
              key={team.id}
              data-testid="deleted-team-row"
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: `${t.space[2]}px`,
                paddingBlock: `${t.space[3]}px`,
                borderBlockEnd: `1px solid ${t.color.border}`,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 160px' }}>
                <Typography sx={{ ...t.type.rowTitle, color: t.color.text, overflowWrap: 'anywhere' }}>{team.name}</Typography>
                <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                  {[team.mainOffice, Strings.deletedTeams.sprintCount(team.sprintCount), Strings.deletedTeams.daysLeft(team.daysLeft)].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Button
                variant="secondary"
                size="sm"
                icon="refresh"
                onPress={() => d.restore(team)}
                disabled={d.restoringId !== null}
                loading={d.restoringId === team.id}
              >
                {Strings.deletedTeams.restoreButton}
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}
