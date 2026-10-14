import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { formatDateRange } from '@/lib/format-date';
import { useDeletedSprints } from '../hooks/use-deleted-sprints';

interface DeletedSprintsSectionProps {
  teamId: number;
  token: string;
  onRestored: () => void;
}

/** גרסת native של "ספרינטים שנמחקו" (פיצ'ר 14, §14.2) — אותו hook, תצוגה ב-React Native. */
export function DeletedSprintsSectionNative({ teamId, token, onRestored }: DeletedSprintsSectionProps) {
  const t = useTheme();
  const d = useDeletedSprints({ teamId, token, onRestored });
  const type = (entry: { fontSize: number; lineHeight: number }) => ({ fontSize: entry.fontSize, lineHeight: Math.round(entry.fontSize * entry.lineHeight) });

  return (
    <View style={{ gap: t.space[2] }}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={d.toggle}
        style={{ alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 4, minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[2] }}
      >
        <Icon name={d.isOpen ? 'x' : 'trash'} size="sm" tone="muted" />
        <Text style={[type(t.type.bodyStrong), { fontWeight: '600', color: t.color.textSecondary }]}>
          {d.isOpen ? Strings.sprintDeletion.hideDeletedButton : Strings.sprintDeletion.deletedSectionTitle}
        </Text>
      </TouchableOpacity>

      {d.isOpen && (
        <View testID="deleted-sprints" style={{ gap: t.space[2] }}>
          {!!d.error && (
            <View style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[2] }}>
              <Text style={[type(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{d.error}</Text>
            </View>
          )}

          {d.isLoading ? (
            <ActivityIndicator size="small" color={t.color.accent.base} />
          ) : d.items.length === 0 ? (
            !d.error && <Text style={[type(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.sprintDeletion.noDeleted}</Text>
          ) : (
            d.items.map((sprint) => (
              <View
                key={sprint.id}
                testID="deleted-sprint-row"
                style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2], paddingVertical: t.space[2], borderBottomWidth: 1, borderBottomColor: t.color.border, opacity: 0.85 }}
              >
                <View style={{ flex: 1, flexShrink: 1, minWidth: 160 }}>
                  <Text style={[type(t.type.rowTitle), { fontWeight: '600', color: t.color.text, textAlign: 'right' }]}>{sprint.name}</Text>
                  <Text style={[type(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
                    {`${formatDateRange(sprint.startDate, sprint.endDate)} · ${Strings.sprintDeletion.commentCount(sprint.commentCount)} · ${Strings.sprintDeletion.daysLeft(sprint.daysLeft)}`}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => d.restore(sprint)}
                  disabled={d.restoringId !== null}
                  style={{ minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[3], borderRadius: t.radius.field, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surface, justifyContent: 'center', alignItems: 'center' }}
                >
                  {d.restoringId === sprint.id ? (
                    <ActivityIndicator size="small" color={t.color.text} />
                  ) : (
                    <Text style={[type(t.type.bodyStrong), { fontWeight: '600', color: t.color.text }]}>{Strings.sprintDeletion.restoreButton}</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}
