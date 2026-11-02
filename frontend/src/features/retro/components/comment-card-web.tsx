import React, { useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon, Badge, Button, TeamLogo, ActionMenu, type ActionMenuItem } from '@/components/ui';
import { GuideAnchor } from '@/components/ui/guide-anchor';
import { getCommentCategoryLabel, getCommentAuthorName, getPostedByAdminLabel, isFormerMemberComment, isCommentEdited } from '../comment-display';
import { formatDate, formatTime } from '@/lib/format-date';
import { trackEvent } from '@/lib/analytics';
import type { CommentActions } from '../hooks/use-comment-actions';
import { useReturnFocus } from '../hooks/use-return-focus';
import type { BoardComment, CategoryOption } from '../comment-types';
import { CommentEditFormWeb } from './comment-edit-form-web';
import { CommentDeleteConfirmWeb } from './comment-delete-confirm-web';

interface CommentCardWebProps {
  comment: {
    id: number;
    content: string;
    type: 'KEEP' | 'IMPROVE';
    category?: { id: number; label: string } | null;
    isAnonymous: boolean;
    isHighlighted?: boolean;
    author: { username: string; firstName?: string | null; lastName?: string | null };
    // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2): always visible
    // when present — see comment-display.ts::getPostedByAdminLabel.
    postedByAdmin?: { id: number; username: string; firstName?: string | null; lastName?: string | null } | null;
    createdAt: string;
    // Feature 13: edited label + what the server lets this viewer do with the comment.
    updatedAt?: string | null;
    isMine?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  };
  index: number;
  /** מוצג רק למנהלי צוות/ראשי צוותים — ראו product-backlog/02-comment-highlighting.md §2. */
  canHighlight?: boolean;
  onToggleHighlight?: (commentId: number, nextValue: boolean) => void;
  /** פיצ'ר 19, החלטה #10: סימן אנונימיות — לוגו הצוות לפני המילה "אנונימי". */
  teamLogo?: { teamId: number; name: string; logoUpdatedAt?: string | null };
  /** פיצ'ר 20: "הצע כנקודה" — כל חבר צוות. כשלא מועבר, הכפתור לא מוצג (למשל בלוח הזיכרון). */
  onPropose?: (commentId: number) => void;
  /** פיצ'ר 20: המשתמש כבר הציע את ההערה הזו (אותו חבר לא מציע פעמיים). */
  isProposed?: boolean;
  /** פיצ'ר 13: עריכה/מחיקה. כשלא מועבר (למשל בכרטיסים בלי לוח) אין תפריט. */
  actions?: CommentActions;
  /** פיצ'ר 13: הקטגוריות שאפשר לבחור בעריכה (כולל הנוכחית של ההערה). */
  categoryOptions?: CategoryOption[];
  /** פיצ'ר 13: עוגן המדריך על התפריט — רק על ההערה הראשונה שאפשר לערוך. */
  guideAnchor?: boolean;
}

export function CommentCardWeb({ comment, canHighlight, onToggleHighlight, teamLogo, onPropose, isProposed, actions, categoryOptions = [], guideAnchor }: CommentCardWebProps) {
  const t = useTheme();
  const isKeep = comment.type === 'KEEP';
  const accent = isKeep ? t.color.status.success : t.color.status.danger;
  const isHighlighted = !!comment.isHighlighted;
  const categoryLabel = getCommentCategoryLabel(comment);
  const authorName = getCommentAuthorName(comment);
  const postedByAdminLabel = getPostedByAdminLabel(comment);
  const boardComment = comment as BoardComment;
  const isEditing = actions?.editingId === comment.id;
  const isDeleting = actions?.deletingId === comment.id;
  const ownError = actions?.error?.id === comment.id ? (actions.error?.message ?? null) : null;
  const menuItems: ActionMenuItem[] = [
    ...(actions && comment.canEdit ? [{ key: 'edit', icon: 'edit' as const, label: Strings.retroBoard.editCommentButton, onPress: () => actions.startEdit(boardComment) }] : []),
    ...(actions && comment.canDelete ? [{ key: 'delete', icon: 'trash' as const, label: Strings.retroBoard.deleteCommentButton, tone: 'danger' as const, onPress: () => actions.askDelete(boardComment) }] : []),
  ];
  const menu = menuItems.length > 0 && !isEditing ? (
    <ActionMenu
      label={Strings.retroBoard.commentMenuLabel}
      items={menuItems}
      onOpen={() => trackEvent('comment_menu_opened', { canEdit: !!comment.canEdit, canDelete: !!comment.canDelete })}
    />
  ) : null;
  // Keyboard: when the editor / delete confirmation closes, focus returns to this card's "⋯" button.
  const cardRef = useRef<HTMLDivElement>(null);
  useReturnFocus(isEditing || isDeleting, cardRef);

  return (
    <Box
      ref={cardRef}
      sx={{
        // הדגשת הערה היא סימון סמנטי — נשארת בצבע האפליקציה גם בתוך אזור הצוות (פיצ'ר 19, החלטה #11).
        backgroundColor: isHighlighted ? t.color.appAccent.subtle : t.color.surface,
        border: `1px solid ${isHighlighted ? t.color.appAccent.border : 'transparent'}`,
        borderInlineStart: `3px solid ${accent.fg}`,
        borderRadius: `${t.radius.card}px`,
        boxShadow: t.shadow.sm,
      }}
    >
      <Box sx={{ padding: `${t.space[4]}px`, display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px`, textAlign: 'start' }}>
        {isEditing && actions ? (
          <CommentEditFormWeb
            comment={boardComment}
            categoryOptions={categoryOptions}
            busy={actions.busy}
            error={ownError}
            onSave={(patch) => actions.saveEdit(boardComment, patch)}
            onCancel={actions.cancelEdit}
          />
        ) : (<>
        {(categoryLabel || canHighlight || isHighlighted || menu) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
            {categoryLabel ? (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  paddingInline: `${t.space[2]}px`,
                  paddingBlock: '3px',
                  borderRadius: '8px 3px 8px 3px',
                  backgroundColor: accent.bg,
                  color: accent.fg,
                  ...t.type.overline,
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
            ) : (
              <Box />
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
            {canHighlight ? (
              <Box
                component="button"
                type="button"
                onClick={() => onToggleHighlight?.(comment.id, !isHighlighted)}
                aria-label={isHighlighted ? Strings.retroBoard.unhighlightButton : Strings.retroBoard.highlightButton}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  borderRadius: `${t.radius.field}px`,
                  '&:hover': { backgroundColor: t.color.surfaceHover },
                }}
              >
                <Icon name="star" size="sm" tone={isHighlighted ? 'appAccent' : 'muted'} />
              </Box>
            ) : isHighlighted ? (
              <Icon name="star" size="sm" tone="appAccent" />
            ) : null}
            {menu ? (guideAnchor ? <GuideAnchor name="board-comment-menu">{menu}</GuideAnchor> : menu) : null}
            </Box>
          </Box>
        )}

        {postedByAdminLabel && (
          <Box
            sx={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: '6px',
              paddingInline: '8px',
              paddingBlock: '4px',
              borderRadius: `${t.radius.pill}px`,
              backgroundColor: t.color.appAccent.subtle,
              border: `1px solid ${t.color.appAccent.border}`,
            }}
          >
            <Icon name="ghost" size="sm" tone="appAccent" />
            <Typography sx={{ ...t.type.caption, fontWeight: 700, color: t.color.appAccent.base }}>
              <bdi>{postedByAdminLabel}</bdi>
            </Typography>
          </Box>
        )}

        <Typography sx={{ ...t.type.body, color: t.color.text }}>
          {comment.content}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[1]}px` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[1]}px`, minWidth: 0 }}>
            {comment.isAnonymous && teamLogo && <TeamLogo teamId={teamLogo.teamId} name={teamLogo.name} logoUpdatedAt={teamLogo.logoUpdatedAt} marker />}
            <Typography sx={{ ...t.type.caption, fontWeight: comment.isAnonymous ? 400 : 600, color: t.color.textSecondary }}>
              <bdi>{authorName}</bdi>
            </Typography>
            {isFormerMemberComment(comment) && <Badge tone="neutral">{Strings.retroBoard.formerMemberBadge}</Badge>}
          </Box>
          <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
            <bdi>
              {new Date(comment.createdAt).toLocaleDateString('he-IL')} · {new Date(comment.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </bdi>
            {isCommentEdited(comment) ? (
              <Box component="span" title={Strings.retroBoard.editedTitle(`${formatDate(comment.updatedAt!)} ${formatTime(comment.updatedAt!)}`)}>
                {' · '}{Strings.retroBoard.editedLabel}
              </Box>
            ) : null}
          </Typography>
        </Box>

        {isDeleting && actions ? (
          <CommentDeleteConfirmWeb
            isModeration={comment.isMine === false}
            busy={actions.busy}
            error={ownError}
            onConfirm={() => actions.confirmDelete(boardComment)}
            onCancel={actions.cancelDelete}
          />
        ) : onPropose && (
          // פיצ'ר 20: שורת פעולה נפרדת מתחת לפרטי ההערה (קו מפריד), עם תווית שמסבירה מה הכפתור עושה.
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: `${t.space[2]}px`,
              borderTop: `1px solid ${t.color.border}`,
              paddingTop: `${t.space[3]}px`,
              marginTop: `${t.space[1]}px`,
            }}
          >
            {isProposed ? (
              <Badge tone="success" icon="check">{Strings.focusPoints.proposedBadge}</Badge>
            ) : (
              <Button variant="secondary" size="sm" icon="target" onPress={() => onPropose(comment.id)}>
                {isKeep ? Strings.focusPoints.proposeKeepButton : Strings.focusPoints.proposeButton}
              </Button>
            )}
            <Typography sx={{ ...t.type.caption, color: t.color.textMuted, flex: '1 1 160px', minWidth: 0 }}>
              {isProposed ? Strings.focusPoints.proposedHint : Strings.focusPoints.proposeHint}
            </Typography>
          </Box>
        )}
        </>)}
      </Box>
    </Box>
  );
}
