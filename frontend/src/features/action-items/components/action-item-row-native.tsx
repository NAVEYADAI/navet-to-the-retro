import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { ActionItemMetaNative, rnText } from './action-item-meta-native';
import { STATUS_LABELS } from '../action-items-logic';
import type { ActionItem, ActionItemStatus } from '../types';

interface ActionItemRowNativeProps {
  item: ActionItem;
  disabled?: boolean;
  onSetStatus: (status: ActionItemStatus) => void;
  onEdit: () => void;
  onRemove: () => void;
}

const STATUSES: ActionItemStatus[] = ['OPEN', 'DONE', 'DROPPED'];

export function ActionItemRowNative({ item, disabled, onSetStatus, onEdit, onRemove }: ActionItemRowNativeProps) {
  const t = useTheme();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const linkStyle = [rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.textSecondary }];
  const touch = { minHeight: t.layout.minTouchTarget, justifyContent: 'center' as const, paddingHorizontal: t.space[2] };

  return (
    <View
      style={{
        gap: t.space[2], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field,
        backgroundColor: t.color.surface, opacity: item.status === 'OPEN' ? 1 : 0.7,
      }}
    >
      <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right', textDecorationLine: item.status === 'DONE' ? 'line-through' : 'none' }]}>
        {item.title}
      </Text>
      <ActionItemMetaNative item={item} />
      <View style={{ flexDirection: 'row-reverse', gap: 3, padding: 3, borderRadius: t.radius.field, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surfaceSubtle }}>
        {STATUSES.map((status) => {
          const active = item.status === status;
          return (
            <TouchableOpacity
              key={status}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={disabled}
              onPress={() => !active && onSetStatus(status)}
              style={{ flex: 1, minHeight: t.layout.minTouchTarget - 8, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.badge, backgroundColor: active ? t.color.surface : 'transparent' }}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: active ? 700 : 500 }), { color: active ? t.color.text : t.color.textSecondary }]}>{STATUS_LABELS[status]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {isConfirmingDelete ? (
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
          <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg }]}>{Strings.actionItems.deleteConfirmText}</Text>
          <TouchableOpacity disabled={disabled} onPress={onRemove} style={touch}>
            <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.status.danger.fg }]}>{Strings.actionItems.deleteConfirmButton}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsConfirmingDelete(false)} style={touch}>
            <Text style={linkStyle}>{Strings.actionItems.deleteCancelButton}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
          <TouchableOpacity disabled={disabled} onPress={onEdit} style={touch}>
            <Text style={linkStyle}>{Strings.actionItems.editButton}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={disabled} onPress={() => setIsConfirmingDelete(true)} style={touch}>
            <Text style={linkStyle}>{Strings.actionItems.deleteButton}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
