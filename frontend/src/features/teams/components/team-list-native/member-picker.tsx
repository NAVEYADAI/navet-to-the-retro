import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { rnText } from './team-settings-panel.styles';

interface MemberPickerProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

/** Feature 11 — pick one team member (successor admin / new team leader). Same API as the web one. */
export function MemberPicker({ label, options, selected, onSelect, disabled }: MemberPickerProps) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: t.space[2] }}>
      <Text style={[rnText(t.type.label), { color: t.color.text, textAlign: 'right' }]}>{label}</Text>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        {options.map((o) => {
          const isSelected = selected === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled: !!disabled }}
              disabled={disabled}
              onPress={() => onSelect(o.value)}
              style={{
                minHeight: t.layout.minTouchTarget,
                justifyContent: 'center',
                paddingHorizontal: t.space[3],
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: isSelected ? t.color.accent.border : t.color.border,
                backgroundColor: isSelected ? t.color.accent.subtle : t.color.surface,
                flexShrink: 1,
                maxWidth: '100%',
              }}
            >
              <Text numberOfLines={1} style={[rnText({ ...t.type.caption, fontWeight: isSelected ? 700 : 500 }), { color: isSelected ? t.color.accent.base : t.color.textSecondary }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
