import React from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { GuideAnchor } from '@/components/ui/guide-anchor';
import { animateNextLayout } from '@/lib/animate-layout';
import { formatDate, formatTime } from '@/lib/format-date';
import { ActionButtonNative, CardNative, rnText } from '@/features/focus-points/components/native-parts';
import { getCommentAuthorName, formatUserDisplayName } from '../comment-display';
import type { useDeletedComments } from '../hooks/use-deleted-comments';

/** Feature 13 §13.0 decision #5/#6 — native twin of deleted-comments-panel-web.tsx (admin only). */
export function DeletedCommentsPanelNative({ deleted }: { deleted: ReturnType<typeof useDeletedComments> }) {
  const t = useTheme();
  const { isOpen, items, isLoading, error, toggle, refresh } = deleted;

  return (
    <GuideAnchor name="board-deleted-comments">
      <CardNative>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right', flexShrink: 1 }]}>{Strings.retroBoard.deletedPanelTitle}</Text>
          <View style={{ flexDirection: 'row-reverse', gap: t.space[1] }}>
            {isOpen && <ActionButtonNative label={Strings.common.refreshButton} variant="ghost" onPress={refresh} disabled={isLoading} />}
            <ActionButtonNative
              label={isOpen ? Strings.retroBoard.adminToolsCloseButton : Strings.retroBoard.adminToolsOpenButton}
              variant="ghost"
              accessibilityLabel={isOpen ? Strings.retroBoard.deletedPanelCloseLabel : Strings.retroBoard.deletedPanelOpenLabel}
              expanded={isOpen}
              onPress={() => { animateNextLayout(); toggle(); }}
            />
          </View>
        </View>
        <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{Strings.retroBoard.deletedPanelHint}</Text>

        {isOpen && (
          <View style={{ gap: t.space[3] }}>
            {!!error && (
              <View style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[2] }}>
                <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{error}</Text>
              </View>
            )}
            {isLoading ? (
              <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.retroBoard.deletedPanelLoading}</Text>
            ) : !error && items.length === 0 ? (
              <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{Strings.retroBoard.deletedPanelEmpty}</Text>
            ) : (
              items.map((item) => {
                const tone = item.type === 'KEEP' ? t.color.status.success : t.color.status.danger;
                return (
                  <View
                    key={item.id}
                    testID="deleted-comment"
                    style={{ gap: t.space[1], padding: t.space[3], backgroundColor: t.color.surfaceSubtle, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card }}
                  >
                    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
                      <View style={{ backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border, borderRadius: t.radius.badge, paddingHorizontal: t.space[2] }}>
                        <Text style={[rnText(t.type.caption), { color: tone.fg }]}>{item.type === 'KEEP' ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}</Text>
                      </View>
                      {!!item.category?.label && (
                        <View style={{ backgroundColor: t.color.status.neutral.bg, borderWidth: 1, borderColor: t.color.status.neutral.border, borderRadius: t.radius.badge, paddingHorizontal: t.space[2] }}>
                          <Text style={[rnText(t.type.caption), { color: t.color.status.neutral.fg }]}>{item.category.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>{item.content}</Text>
                    <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{getCommentAuthorName(item)}</Text>
                    <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>
                      {`${item.deletedByAuthor ? Strings.retroBoard.deletedByAuthor : item.deletedBy ? Strings.retroBoard.deletedBy(formatUserDisplayName(item.deletedBy)) : ''} ${Strings.retroBoard.deletedAtLabel(`${formatDate(item.deletedAt)} ${formatTime(item.deletedAt)}`)}`.trim()}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </CardNative>
    </GuideAnchor>
  );
}
