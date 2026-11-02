import React from 'react';
import { View, Text, TouchableOpacity, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon, TeamLogo, ActionMenu, type ActionMenuItem } from '@/components/ui';
import { GuideAnchor } from '@/components/ui/guide-anchor';
import { formatDate, formatTime } from '@/lib/format-date';
import { getCommentCategoryLabel, getCommentAuthorName, getPostedByAdminLabel, isFormerMemberComment, isCommentEdited } from '../comment-display';
import { trackEvent } from '@/lib/analytics';
import type { CommentActions } from '../hooks/use-comment-actions';
import type { BoardComment, CategoryOption } from '../comment-types';
import { CommentEditFormNative } from './comment-edit-form-native';
import { CommentDeleteConfirmNative } from './comment-delete-confirm-native';

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

interface CommentCardNativeProps {
  comment: any;
  accent: { fg: string; bg: string; border: string };
  team: { id: number; name: string; logoUpdatedAt?: string | null };
  canHighlight: boolean;
  onToggleHighlight: (commentId: number, nextValue: boolean) => void;
  /** פיצ'ר 20 */
  isProposed: boolean;
  onPropose: (commentId: number) => void;
  /** פיצ'ר 13: עריכה/מחיקה, ועוגן המדריך (רק על ההערה הראשונה שאפשר לערוך). */
  actions: CommentActions;
  categoryOptions: CategoryOption[];
  guideAnchor?: boolean;
}

/** כרטיס הערה בלוח ה-native — הוצא מ-sprint-retro-board-native.tsx כשנוספו עריכה/מחיקה (פיצ'ר 13). */
export function CommentCardNative({ comment, accent, team, canHighlight, onToggleHighlight, isProposed, onPropose, actions, categoryOptions, guideAnchor }: CommentCardNativeProps) {
  const t = useTheme();
  const categoryLabel = getCommentCategoryLabel(comment);
  const isHighlighted = !!comment.isHighlighted;
  const authorName = getCommentAuthorName(comment);
  const postedByAdminLabel = getPostedByAdminLabel(comment);
  const boardComment = comment as BoardComment;
  const isEditing = actions.editingId === comment.id;
  const isDeleting = actions.deletingId === comment.id;
  const ownError = actions.error?.id === comment.id ? (actions.error?.message ?? null) : null;
  const menuItems: ActionMenuItem[] = [
    ...(comment.canEdit ? [{ key: 'edit', icon: 'edit' as const, label: Strings.retroBoard.editCommentButton, onPress: () => actions.startEdit(boardComment) }] : []),
    ...(comment.canDelete ? [{ key: 'delete', icon: 'trash' as const, label: Strings.retroBoard.deleteCommentButton, tone: 'danger' as const, onPress: () => actions.askDelete(boardComment) }] : []),
  ];
  const menu = menuItems.length > 0 ? (
    <ActionMenu
      label={Strings.retroBoard.commentMenuLabel}
      items={menuItems}
      onOpen={() => trackEvent('comment_menu_opened', { canEdit: !!comment.canEdit, canDelete: !!comment.canDelete })}
    />
  ) : null;

  return (
    <View
      style={{
        // הדגשה = סימון סמנטי, נשאר בצבע האפליקציה בתוך אזור הצוות (פיצ'ר 19, החלטה #11).
        backgroundColor: isHighlighted ? t.color.appAccent.subtle : t.color.surface,
        borderWidth: isHighlighted ? 1 : 0,
        borderColor: t.color.appAccent.border,
        borderRightWidth: 3,
        borderRightColor: accent.fg,
        borderRadius: t.radius.card,
        padding: t.space[3],
        gap: t.space[2],
      }}
    >
      {isEditing ? (
        <CommentEditFormNative
          comment={boardComment}
          categoryOptions={categoryOptions}
          busy={actions.busy}
          error={ownError}
          onSave={(patch) => actions.saveEdit(boardComment, patch)}
          onCancel={actions.cancelEdit}
        />
      ) : (
        <>
          {(!!categoryLabel || canHighlight || isHighlighted || !!menu) && (
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
              {!!categoryLabel ? (
                <View style={{ backgroundColor: accent.bg, borderRadius: t.radius.pill, borderTopRightRadius: t.radius.badge, paddingHorizontal: t.space[2], paddingVertical: 3 }}>
                  <Text style={[rnText(t.type.overline), { color: accent.fg }]}>{categoryLabel}</Text>
                </View>
              ) : (
                <View />
              )}

              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                {canHighlight ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={isHighlighted ? Strings.retroBoard.unhighlightButton : Strings.retroBoard.highlightButton}
                    onPress={() => onToggleHighlight(comment.id, !isHighlighted)}
                    style={{ width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="star" size="sm" tone={isHighlighted ? 'appAccent' : 'muted'} />
                  </TouchableOpacity>
                ) : isHighlighted ? (
                  <Icon name="star" size="sm" tone="appAccent" />
                ) : null}
                {menu ? (guideAnchor ? <GuideAnchor name="board-comment-menu">{menu}</GuideAnchor> : menu) : null}
              </View>
            </View>
          )}
          {!!postedByAdminLabel && (
            <View
              style={{
                flexDirection: 'row-reverse',
                alignSelf: 'flex-end',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: t.radius.pill,
                backgroundColor: t.color.appAccent.subtle,
                borderWidth: 1,
                borderColor: t.color.appAccent.border,
              }}
            >
              <Icon name="ghost" size="sm" tone="appAccent" />
              <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.appAccent.base, textAlign: 'right' }]}>
                {postedByAdminLabel}
              </Text>
            </View>
          )}
          <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>{comment.content}</Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: t.space[1] }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1], flexShrink: 1 }}>
              {comment.isAnonymous && <TeamLogo teamId={team.id} name={team.name} logoUpdatedAt={team.logoUpdatedAt} marker />}
              <Text style={[rnText({ ...t.type.caption, fontWeight: comment.isAnonymous ? 400 : 700 }), { color: t.color.textSecondary, flexShrink: 1 }]}>
                {authorName}
              </Text>
              {isFormerMemberComment(comment) && (
                <View style={{ backgroundColor: t.color.status.neutral.bg, borderWidth: 1, borderColor: t.color.status.neutral.border, borderRadius: t.radius.badge, paddingHorizontal: t.space[1] }}>
                  <Text style={[rnText(t.type.caption), { color: t.color.status.neutral.fg }]}>{Strings.retroBoard.formerMemberBadge}</Text>
                </View>
              )}
            </View>
            <Text style={[rnText(t.type.caption), { color: t.color.textMuted }]}>
              {`${formatDate(comment.createdAt)} · ${formatTime(comment.createdAt)}`}
              {isCommentEdited(comment) ? ` · ${Strings.retroBoard.editedLabel}` : ''}
            </Text>
          </View>
          {isDeleting ? (
            <CommentDeleteConfirmNative
              isModeration={comment.isMine === false}
              busy={actions.busy}
              error={ownError}
              onConfirm={() => actions.confirmDelete(boardComment)}
              onCancel={actions.cancelDelete}
            />
          ) : (
            /* פיצ'ר 20: שורת פעולה נפרדת מתחת לפרטי ההערה, עם תווית שמסבירה מה הכפתור עושה. */
            <View style={{ borderTopWidth: 1, borderTopColor: t.color.border, paddingTop: t.space[2], gap: t.space[1] }}>
              {isProposed ? (
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1] }}>
                  <Icon name="check" size="sm" tone="success" />
                  <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.status.success.fg }]}>{Strings.focusPoints.proposedBadge}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => onPropose(comment.id)}
                  style={{
                    alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1], minHeight: t.layout.minTouchTarget,
                    paddingHorizontal: t.space[3], borderRadius: t.radius.field, borderWidth: 1, borderColor: t.color.borderStrong, backgroundColor: t.color.surface,
                  }}
                >
                  <Icon name="target" size="sm" tone="default" />
                  <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                    {comment.type === 'KEEP' ? Strings.focusPoints.proposeKeepButton : Strings.focusPoints.proposeButton}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>
                {isProposed ? Strings.focusPoints.proposedHint : Strings.focusPoints.proposeHint}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
