import React from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { ActionItemMetaNative, rnText } from './action-item-meta-native';
import { useMyActionItems } from '../hooks/use-my-action-items';

/** Dashboard card: my open follow-up tasks across all teams. Renders nothing when I have none. */
export function MyActionItemsCardNative({ token, refreshKey }: { token: string | null | undefined; refreshKey: number }) {
  const t = useTheme();
  const { items, loadError } = useMyActionItems(token, refreshKey);
  if (items.length === 0 && !loadError) return null;

  return (
    <View style={{ gap: t.space[2], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card, backgroundColor: t.color.surface }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
        <Text style={[rnText(t.type.cardTitle), { color: t.color.text }]}>{Strings.actionItems.myTasksTitle}</Text>
        {items.length > 0 && <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.accent.base }]}>{String(items.length)}</Text>}
      </View>
      {loadError ? (
        <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{loadError}</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={{ gap: t.space[1], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field }}>
            <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>{item.title}</Text>
            <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{item.team.name}</Text>
            <ActionItemMetaNative item={item} showSprint />
          </View>
        ))
      )}
    </View>
  );
}
