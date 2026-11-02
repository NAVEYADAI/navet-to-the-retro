import React, { useId } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card, Collapse } from '@/components/ui';
import { GuideAnchor } from '@/components/ui/guide-anchor';
import { formatDate, formatTime } from '@/lib/format-date';
import { getCommentAuthorName, formatUserDisplayName } from '../comment-display';
import type { useDeletedComments } from '../hooks/use-deleted-comments';

/**
 * Feature 13 §13.0 decision #5/#6 — "הערות שנמחקו": admin only (the board decides whether to render
 * it). Anonymous comments stay masked; who deleted a comment and when is shown. Nothing is fetched
 * until the panel is opened.
 */
export function DeletedCommentsPanelWeb({ deleted }: { deleted: ReturnType<typeof useDeletedComments> }) {
  const t = useTheme();
  const { isOpen, items, isLoading, error, toggle, refresh } = deleted;
  const regionId = useId();

  return (
    <GuideAnchor name="board-deleted-comments">
      <Card>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0, minWidth: 0 }}>
            {Strings.retroBoard.deletedPanelTitle}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
            {isOpen ? (
              <Button variant="ghost" size="sm" icon="refresh" iconOnlyOnMobile onPress={refresh} disabled={isLoading}>
                {Strings.common.refreshButton}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onPress={toggle}
              ariaLabel={isOpen ? Strings.retroBoard.deletedPanelCloseLabel : Strings.retroBoard.deletedPanelOpenLabel}
              ariaExpanded={isOpen}
              ariaControls={regionId}
            >
              {isOpen ? Strings.retroBoard.adminToolsCloseButton : Strings.retroBoard.adminToolsOpenButton}
            </Button>
          </Box>
        </Box>
        <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{Strings.retroBoard.deletedPanelHint}</Typography>

        <Collapse open={isOpen} id={regionId}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
            {error ? <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert> : null}
            {isLoading ? (
              <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{Strings.retroBoard.deletedPanelLoading}</Typography>
            ) : !error && items.length === 0 ? (
              <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{Strings.retroBoard.deletedPanelEmpty}</Typography>
            ) : (
              items.map((item) => (
                <Box
                  key={item.id}
                  data-testid="deleted-comment"
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${t.space[1] + 2}px`,
                    padding: `${t.space[3]}px ${t.space[4]}px`,
                    backgroundColor: t.color.surfaceSubtle,
                    border: `1px solid ${t.color.border}`,
                    borderRadius: `${t.radius.card}px`,
                  }}
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
                    <Badge tone={item.type === 'KEEP' ? 'success' : 'danger'}>
                      {item.type === 'KEEP' ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}
                    </Badge>
                    {item.category?.label ? <Badge tone="neutral">{item.category.label}</Badge> : null}
                  </Box>
                  <Typography sx={{ ...t.type.body, color: t.color.text }}>{item.content}</Typography>
                  <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                    <bdi>{getCommentAuthorName(item)}</bdi>
                  </Typography>
                  <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
                    {item.deletedByAuthor
                      ? Strings.retroBoard.deletedByAuthor
                      : item.deletedBy
                        ? Strings.retroBoard.deletedBy(formatUserDisplayName(item.deletedBy))
                        : null}
                    {' '}
                    <bdi>{Strings.retroBoard.deletedAtLabel(`${formatDate(item.deletedAt)} ${formatTime(item.deletedAt)}`)}</bdi>
                  </Typography>
                </Box>
              ))
            )}
          </Box>
        </Collapse>
      </Card>
    </GuideAnchor>
  );
}
