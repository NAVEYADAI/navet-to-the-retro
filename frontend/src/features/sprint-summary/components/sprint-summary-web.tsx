import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Page, PageHeader, Card, Button } from '@/components/ui';
import { computeSprintSummaryStats } from '../stats';
import { SPRINT_SUMMARY_TEMPLATES, type SprintSummaryTemplateId } from '../templates';

// Prefers the RFC 5987 `filename*=UTF-8''...` form the backend sends (carries the real Hebrew
// name) over the plain ASCII-only `filename="..."` fallback.
function extractFileName(contentDisposition: string | undefined): string | null {
  if (!contentDisposition) return null;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  const plainMatch = contentDisposition.match(/filename="([^"]+)"/i);
  return plainMatch ? plainMatch[1] : null;
}

interface SprintSummaryWebProps {
  sprint: any;
  team: any;
  token: string;
  onBack: () => void;
}

export function SprintSummaryWeb({ sprint, team, token, onBack }: SprintSummaryWebProps) {
  const t = useTheme();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<SprintSummaryTemplateId>('classic');

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments for summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sprint.id, token]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleDownload = async () => {
    setError(null);
    setIsDownloading(true);
    try {
      const response = await axios.get(
        `${getBackendUrl()}/teams/${team.id}/sprints/${sprint.id}/summary/export`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob', params: { template: templateId } }
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = extractFileName(response.headers['content-disposition']) || `sprint-summary-${sprint.id}.pptx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export sprint summary:', err);
      setError(Strings.sprintSummary.downloadErrorText);
    } finally {
      setIsDownloading(false);
    }
  };

  const stats = computeSprintSummaryStats(comments);

  return (
    <Page>
      <PageHeader
        title={Strings.sprintSummary.pageTitle}
        subtitle={Strings.sprintSummary.pageSubtitle}
        action={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
            <Button variant="ghost" size="sm" icon="refresh" onPress={fetchComments} disabled={isLoading}>
              {Strings.common.refreshButton}
            </Button>
            <Button variant="secondary" onPress={onBack}>{Strings.sprintSummary.backButton}</Button>
          </Box>
        }
      />

      {error ? (
        <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert>
      ) : null}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', paddingBlock: `${t.space[6]}px` }}>
          <CircularProgress sx={{ color: t.color.accent.base }} />
        </Box>
      ) : (
        <Card>
          <Typography sx={{ ...t.type.cardTitle, color: t.color.text }}>{sprint.name}</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
            {team.name} •{' '}
            <bdi>
              {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
            </bdi>
          </Typography>

          {stats.total === 0 ? (
            <Typography sx={{ ...t.type.body, color: t.color.textSecondary, fontStyle: 'italic' }}>
              {Strings.sprintSummary.noCommentsText}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[5]}px` }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, minWidth: 100 }}>
                <Typography sx={{ ...t.type.label, color: t.color.textSecondary }}>
                  {Strings.sprintSummary.totalCommentsLabel}
                </Typography>
                <Typography sx={{ ...t.type.pageTitle, color: t.color.text }}>{stats.total}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, minWidth: 100 }}>
                <Typography sx={{ ...t.type.label, color: t.color.status.success.fg }}>
                  {Strings.sprintSummary.keepCountLabel}
                </Typography>
                <Typography sx={{ ...t.type.pageTitle, color: t.color.status.success.fg }}>{stats.keepCount}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, minWidth: 100 }}>
                <Typography sx={{ ...t.type.label, color: t.color.status.danger.fg }}>
                  {Strings.sprintSummary.improveCountLabel}
                </Typography>
                <Typography sx={{ ...t.type.pageTitle, color: t.color.status.danger.fg }}>{stats.improveCount}</Typography>
              </Box>
            </Box>
          )}

          {stats.byCategory.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
              <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
                {Strings.sprintSummary.byCategoryHeader}
              </Typography>
              {stats.byCategory.map(({ label, count }) => (
                <Box
                  key={label}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: `${t.space[3]}px`,
                    paddingBlock: `${t.space[1] + 2}px`,
                    borderBottom: `1px solid ${t.color.border}`,
                  }}
                >
                  <Typography sx={{ ...t.type.body, color: t.color.text }}>{label}</Typography>
                  <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}><bdi>{count}</bdi></Typography>
                </Box>
              ))}
            </Box>
          ) : null}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
            <Typography sx={{ ...t.type.label, color: t.color.textSecondary }}>
              {Strings.sprintSummary.templateLabel}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
              {SPRINT_SUMMARY_TEMPLATES.map((tpl) => {
                const selected = templateId === tpl.id;
                return (
                  <Box
                    key={tpl.id}
                    component="button"
                    type="button"
                    onClick={() => setTemplateId(tpl.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${t.space[1] + 2}px`,
                      borderRadius: `${t.radius.pill}px`,
                      border: `1.5px solid ${selected ? t.color.accent.base : t.color.border}`,
                      backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
                      paddingBlock: '7px',
                      paddingInline: `${t.space[3]}px`,
                      cursor: 'pointer',
                      transition: `border-color ${t.motion.fast}, background-color ${t.motion.fast}`,
                    }}
                  >
                    <Box sx={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: tpl.swatch, flexShrink: 0 }} />
                    <Typography sx={{ ...t.type.caption, fontWeight: selected ? 700 : 500, color: selected ? t.color.accent.base : t.color.textSecondary }}>
                      {tpl.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" icon="download" onPress={handleDownload} disabled={isDownloading} loading={isDownloading}>
              {isDownloading ? Strings.sprintSummary.downloadingButton : Strings.sprintSummary.downloadButton}
            </Button>
          </Box>
        </Card>
      )}
    </Page>
  );
}
