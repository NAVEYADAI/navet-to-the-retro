import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
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

interface SprintLengthHistoryPanelNativeProps {
  teamId: number;
  sprintId: number;
  token: string;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
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
// (frontend/src/features/teams/components/team-list-native/invite-links-panel.tsx), per §5.2 —
// only rendered by the caller for admin/TEAM_LEADER (assertCanManageTeamContent parity).
export function SprintLengthHistoryPanelNative({ teamId, sprintId, token }: SprintLengthHistoryPanelNativeProps) {
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
    <View style={{ gap: t.space[2] }}>
      <TouchableOpacity
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: t.space[2],
          paddingVertical: t.space[1],
          alignSelf: 'flex-end',
        }}
        onPress={handleToggle}
      >
        <Icon name="history" size="sm" tone="muted" />
        <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
          {isExpanded ? Strings.retroBoard.lengthHistoryHideButton : Strings.retroBoard.lengthHistoryShowButton}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View
          style={{
            backgroundColor: t.color.surface,
            borderWidth: 1,
            borderColor: t.color.border,
            borderRadius: t.radius.card,
            padding: t.space[3],
            gap: t.space[2],
          }}
        >
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>
            {Strings.retroBoard.lengthHistoryTitle}
          </Text>

          {!!error && (
            <View
              style={{
                backgroundColor: t.color.status.danger.bg,
                borderWidth: 1,
                borderColor: t.color.status.danger.border,
                borderRadius: t.radius.field,
                padding: t.space[2],
              }}
            >
              <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
                {error}
              </Text>
            </View>
          )}

          {isLoading ? (
            <ActivityIndicator size="small" color={t.color.text} />
          ) : history.length === 0 ? (
            <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>
              {Strings.retroBoard.lengthHistoryEmptyText}
            </Text>
          ) : (
            history.map((entry) => {
              const isBaseline = entry.previousStartDate === null || entry.previousEndDate === null;
              const newLength = lengthInDays(entry.newStartDate, entry.newEndDate);
              const previousLength = !isBaseline ? lengthInDays(entry.previousStartDate as string, entry.previousEndDate as string) : null;

              return (
                <View
                  key={entry.id}
                  style={{
                    backgroundColor: t.color.surfaceSubtle,
                    borderRadius: t.radius.card,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    paddingHorizontal: t.space[3],
                    paddingVertical: t.space[2],
                    gap: t.space[1],
                  }}
                >
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: t.space[2] }}>
                    <Text
                      style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right', flex: 1 }]}
                      numberOfLines={1}
                    >
                      {formatUserDisplayName(entry.changedBy)}
                    </Text>
                    <Text style={[rnText(t.type.caption), { color: t.color.textMuted }]}>
                      {`${formatDate(entry.createdAt)} ${new Date(entry.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
                    </Text>
                  </View>

                  {isBaseline ? (
                    <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>
                      {`${Strings.retroBoard.lengthHistoryCreatedInitiallyText} · ${Strings.retroBoard.lengthHistoryDaysLabel(newLength)} · ${Strings.retroBoard.lengthHistoryDatesLabel(formatDate(entry.newStartDate), formatDate(entry.newEndDate))}`}
                    </Text>
                  ) : (
                    <>
                      <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>
                        {`${Strings.retroBoard.lengthHistoryPreviousLengthLabel}: ${Strings.retroBoard.lengthHistoryDaysLabel(previousLength as number)} ← ${Strings.retroBoard.lengthHistoryNewLengthLabel}: ${Strings.retroBoard.lengthHistoryDaysLabel(newLength)}`}
                      </Text>
                      <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
                        {`${Strings.retroBoard.lengthHistoryDatesLabel(formatDate(entry.previousStartDate as string), formatDate(entry.previousEndDate as string))} ← ${Strings.retroBoard.lengthHistoryDatesLabel(formatDate(entry.newStartDate), formatDate(entry.newEndDate))}`}
                      </Text>
                    </>
                  )}

                  {!!entry.reason && (
                    <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
                      {`${Strings.retroBoard.lengthHistoryReasonLabel} ${entry.reason}`}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}
