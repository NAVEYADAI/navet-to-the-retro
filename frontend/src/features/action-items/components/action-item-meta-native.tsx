import React from 'react';
import { View, Text, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { assigneeName, formatDueDate, isOverdue } from '../action-items-logic';
import type { ActionItem } from '../types';

export function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function PillNative({ tone, children }: { tone: 'neutral' | 'danger'; children: string }) {
  const t = useTheme();
  const c = t.color.status[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: t.radius.badge, paddingHorizontal: t.space[1] }}>
      <Text style={[rnText(t.type.caption), { color: c.fg }]}>{children}</Text>
    </View>
  );
}

/** Owners + due date line shared by every action-item row (panel, previous strip, dashboard). */
export function ActionItemMetaNative({ item, showSprint }: { item: ActionItem; showSprint?: boolean }) {
  const t = useTheme();
  const caption = [rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' as const }];
  return (
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', columnGap: t.space[3], rowGap: t.space[1] }}>
      {item.assignees.length === 0 ? (
        <Text style={caption}>{Strings.actionItems.assigneesTeam}</Text>
      ) : (
        item.assignees.map((a) => (
          <View key={a.userId} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1] }}>
            <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.textSecondary }]}>{assigneeName(a)}</Text>
            {!a.isActiveMember && <PillNative tone="neutral">{Strings.actionItems.notInTeam}</PillNative>}
          </View>
        ))
      )}
      {item.dueDate ? (
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1] }}>
          <Text style={caption}>{`${Strings.actionItems.dueLabel}: ${formatDueDate(item.dueDate)}`}</Text>
          {isOverdue(item) && <PillNative tone="danger">{Strings.actionItems.overdueBadge}</PillNative>}
        </View>
      ) : null}
      {showSprint ? <Text style={[caption, { color: t.color.textMuted }]}>{Strings.actionItems.bornInSprint(item.sprint.name)}</Text> : null}
    </View>
  );
}
