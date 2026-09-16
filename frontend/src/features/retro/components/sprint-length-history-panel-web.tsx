import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, Typography, Alert } from '@mui/material';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Card } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { formatUserDisplayName } from '../comment-display';

interface SprintLengthChangeEntry {
  id: number;
  previousStartDate: string | null;
  previousEndDate: string | null;
  newStartDate: string;
  newEndDate: string;
  reason: string | null;
  createdAt: string;
  changedBy: { username: string; firstName?: string | null; lastName?: string | null };
}

interface SprintLengthHistoryPanelWebProps {
  teamId: number;
  sprintId: number;
  token: string;
}

// "אורך" is always derived from the two dates (never a stored field) — see product-backlog/
// 05-sprint-length-audit-log.md §5.0 decision #1. Computed client-side here too, from the raw
// dates the API returns, so there's no second source of truth that could drift from them.
function lengthInDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('he-IL');
}

// Collapsible panel copying the isExpanded + fetch-only-on-open structure of InviteLinksPanel
// (frontend/src/features/teams/components/team-list-web/invite-links-panel.tsx), per §5.2 —
// only rendered by the caller for admin/TEAM_LEADER (assertCanManageTeamContent parity).
export function SprintLengthHistoryPanelWeb({ teamId, sprintId, token }: SprintLengthHistoryPanelWebProps) {
  const t = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [history, setHistory] = useState<SprintLengthChangeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${getBackendUrl()}/teams/${teamId}/sprints/${sprintId}/length-history`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistory(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.retroBoard.lengthHistoryErrorText);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, sprintId, token]);

  useEffect(() => {
    if (isExpanded) fetchHistory();
  }, [isExpanded, fetchHistory]);

  const handleToggle = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) trackEvent('sprint_length_history_opened', { sprintId });
      return next;
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
      <Button variant="ghost" size="sm" icon="history" onPress={handleToggle}>
        {isExpanded ? Strings.retroBoard.lengthHistoryHideButton : Strings.retroBoard.lengthHistoryShowButton}
      </Button>

      {isExpanded && (
        <Card>
          <Typography sx={{ ...t.type.cardTitle, color: t.color.text }}>
            {Strings.retroBoard.lengthHistoryTitle}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ ...t.type.body }}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
              {Strings.retroBoard.lengthHistoryLoadingText}
            </Typography>
          ) : history.length === 0 ? (
            <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
              {Strings.retroBoard.lengthHistoryEmptyText}
            </Typography>
          ) : (
            history.map((entry) => {
              const isBaseline = entry.previousStartDate === null || entry.previousEndDate === null;
              const newLength = lengthInDays(entry.newStartDate, entry.newEndDate);
              const previousLength = !isBaseline ? lengthInDays(entry.previousStartDate as string, entry.previousEndDate as string) : null;

              return (
                <Box
                  key={entry.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${t.space[1] + 2}px`,
                    paddingInline: `${t.space[4]}px`,
                    paddingBlock: `${t.space[3]}px`,
                    backgroundColor: t.color.surfaceSubtle,
                    borderRadius: `${t.radius.card}px`,
                    border: `1px solid ${t.color.border}`,
                  }}
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[2]}px` }}>
                    <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, minWidth: 0 }}>
                      {formatUserDisplayName(entry.changedBy)}
                    </Typography>
                    <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
                      <bdi>{`${formatDate(entry.createdAt)} ${new Date(entry.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}</bdi>
                    </Typography>
                  </Box>

                  {isBaseline ? (
                    <Typography sx={{ ...t.type.body, color: t.color.text }}>
                      {Strings.retroBoard.lengthHistoryCreatedInitiallyText}
                      {' · '}
                      <bdi>{Strings.retroBoard.lengthHistoryDaysLabel(newLength)}</bdi>
                      {' · '}
                      <bdi>{Strings.retroBoard.lengthHistoryDatesLabel(formatDate(entry.newStartDate), formatDate(entry.newEndDate))}</bdi>
                    </Typography>
                  ) : (
                    <>
                      <Typography sx={{ ...t.type.body, color: t.color.text }}>
                        {Strings.retroBoard.lengthHistoryPreviousLengthLabel}
                        {': '}
                        <bdi>{Strings.retroBoard.lengthHistoryDaysLabel(previousLength as number)}</bdi>
                        {' ← '}
                        {Strings.retroBoard.lengthHistoryNewLengthLabel}
                        {': '}
                        <bdi>{Strings.retroBoard.lengthHistoryDaysLabel(newLength)}</bdi>
                      </Typography>
                      <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                        <bdi>{Strings.retroBoard.lengthHistoryDatesLabel(formatDate(entry.previousStartDate as string), formatDate(entry.previousEndDate as string))}</bdi>
                        {' ← '}
                        <bdi>{Strings.retroBoard.lengthHistoryDatesLabel(formatDate(entry.newStartDate), formatDate(entry.newEndDate))}</bdi>
                      </Typography>
                    </>
                  )}

                  {entry.reason && (
                    <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                      {Strings.retroBoard.lengthHistoryReasonLabel} {entry.reason}
                    </Typography>
                  )}
                </Box>
              );
            })
          )}
        </Card>
      )}
    </Box>
  );
}
