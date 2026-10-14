import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { ActionItemMetaNative, rnText } from './action-item-meta-native';
import type { ActionItem, ActionItemStatus } from '../types';

interface PreviousActionItemsStripNativeProps {
  items: ActionItem[];
  disabled?: boolean;
  onSetStatus: (item: ActionItem, status: ActionItemStatus) => void;
}

/** "מה בוצע?" — open tasks from earlier retros, closable in one tap. Rendered only when there are any. */
export function PreviousActionItemsStripNative({ items, disabled, onSetStatus }: PreviousActionItemsStripNativeProps) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[2], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card, backgroundColor: t.color.surface }}>
      <View style={{ gap: 2 }}>
        <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>{Strings.actionItems.previousTitle}</Text>
        <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
          {`${Strings.actionItems.previousSubtitle} · ${Strings.actionItems.previousCount(items.length)}`}
        </Text>
      </View>
      {items.map((item) => (
        <View key={item.id} style={{ gap: t.space[2], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field }}>
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>{item.title}</Text>
          <ActionItemMetaNative item={item} showSprint />
          <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onSetStatus(item, 'DONE')}
              style={{ flex: 1, minHeight: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.field, borderWidth: 1, borderColor: t.color.borderStrong, backgroundColor: t.color.surface }}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>{Strings.actionItems.markDoneButton}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onSetStatus(item, 'DROPPED')}
              style={{ flex: 1, minHeight: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.field, borderWidth: 1, borderColor: t.color.border }}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: 600 }), { color: t.color.textSecondary }]}>{Strings.actionItems.markDroppedButton}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}
