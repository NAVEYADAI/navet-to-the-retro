import React from 'react';
import { View, Text, TouchableOpacity, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import type { AssigneeOption } from '../types';

function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

interface AssigneePickerNativeProps {
  options: AssigneeOption[];
  selectedIds: number[];
  onToggle: (userId: number) => void;
  extraSelected?: AssigneeOption[];
}

/** Multi-select as a wrapping row of filter-style pills (a selected pill takes the accent tint). */
export function AssigneePickerNative({ options, selectedIds, onToggle, extraSelected = [] }: AssigneePickerNativeProps) {
  const t = useTheme();
  const all = [...options, ...extraSelected.filter((e) => !options.some((o) => o.userId === e.userId))];
  return (
    <View style={{ gap: t.space[1] }}>
      <Text style={[rnText(t.type.label), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.actionItems.assigneesLabel}</Text>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        {all.map((option) => {
          const selected = selectedIds.includes(option.userId);
          return (
            <TouchableOpacity
              key={option.userId}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onToggle(option.userId)}
              style={{
                minHeight: t.layout.minTouchTarget,
                justifyContent: 'center',
                paddingHorizontal: t.space[3],
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: selected ? t.color.accent.base : t.color.borderStrong,
                backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
              }}
            >
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: selected ? t.color.accent.base : t.color.text }]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{Strings.actionItems.assigneesHint}</Text>
    </View>
  );
}
