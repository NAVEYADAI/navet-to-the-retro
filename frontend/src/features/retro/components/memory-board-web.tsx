import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Page, PageHeader, Button, Icon } from '@/components/ui';
import { MemoryCardWeb } from './memory-card-web';
import { trackEvent } from '@/lib/analytics';

interface MemoryBoardWebProps {
  sprint: any;
  team: any;
  token: string;
  onBack: () => void;
}

/**
 * The KEEP/IMPROVE canvases below are a dedicated flex-wrap layout, not `<Grid columns={n}>` —
 * that component is built for a fixed number of large blocks, not a variable-count card canvas
 * (see product-backlog/08-memory-board.md §8.2 research notes). The screen itself still wraps in `<Page>`.
 */
export function MemoryBoardWeb({ sprint, team, token, onBack }: MemoryBoardWebProps) {
  const t = useTheme();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // BUG-34: a failed load must not render as "no cards".
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments for memory board:', err);
      setLoadError(Strings.memoryBoard.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [sprint.id, token]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const keepComments = comments.filter(c => c.type === 'KEEP');
  const improveComments = comments.filter(c => c.type === 'IMPROVE');

  const renderCanvas = (
    title: string,
    icon: 'check' | 'wrench',
    tone: 'success' | 'danger',
    list: any[],
    emptyText: string
  ) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: `${t.space[2]}px`,
          paddingBlock: `${t.space[2]}px`,
          borderRadius: `${t.radius.card}px`,
          backgroundColor: t.color.status[tone].bg,
          border: `1px solid ${t.color.status[tone].border}`,
        }}
      >
        <Icon name={icon} tone={tone} />
        <Typography sx={{ ...t.type.cardTitle, color: t.color.status[tone].fg }}>{title}</Typography>
      </Box>

      {list.length === 0 ? (
        <Typography sx={{ ...t.type.body, color: t.color.textSecondary, fontStyle: 'italic', textAlign: 'center' }}>
          {emptyText}
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: `${t.space[4]}px`,
            padding: `${t.space[4]}px`,
            borderRadius: `${t.radius.card}px`,
            backgroundColor: t.color.surfaceSubtle,
            minHeight: 220,
          }}
        >
          {list.map(comment => (
            <MemoryCardWeb key={comment.id} comment={comment} />
          ))}
        </Box>
      )}
    </Box>
  );

  return (
    <Page>
      <PageHeader
        title={Strings.memoryBoard.pageTitle}
        subtitle={Strings.memoryBoard.pageSubtitle}
        action={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              iconOnlyOnMobile
              onPress={() => { trackEvent('refresh_clicked', { screen: 'memory_board' }); fetchComments(); }}
              disabled={isLoading}
            >
              {Strings.common.refreshButton}
            </Button>
            <Button variant="secondary" onPress={onBack}>{Strings.memoryBoard.backButton}</Button>
          </Box>
        }
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', paddingBlock: `${t.space[6]}px` }}>
          <CircularProgress sx={{ color: t.color.accent.base }} />
        </Box>
      ) : loadError ? (
        <Alert severity="error" sx={{ ...t.type.body }}>{loadError}</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[6]}px` }}>
          {renderCanvas(Strings.memoryBoard.keepCanvasHeader, 'check', 'success', keepComments, Strings.memoryBoard.emptyKeepText)}
          {renderCanvas(Strings.memoryBoard.improveCanvasHeader, 'wrench', 'danger', improveComments, Strings.memoryBoard.emptyImproveText)}
        </Box>
      )}
    </Page>
  );
}
