import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { rnText } from './team-settings-panel.styles';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  kind: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

/** Small action button used inside team member rows / panels (native has no `ui/Button`). */
export function ActionButton({ label, onPress, kind, disabled, loading }: ActionButtonProps) {
  const t = useTheme();
  const skin = kind === 'primary'
    ? { bg: t.color.accent.base, fg: t.color.accent.onBase, border: t.color.accent.base }
    : kind === 'danger'
      ? { bg: t.color.surface, fg: t.color.status.danger.fg, border: t.color.status.danger.border }
      : { bg: t.color.surface, fg: t.color.text, border: t.color.borderStrong };
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{ minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[4], justifyContent: 'center', alignItems: 'center', borderRadius: t.radius.field, borderWidth: 1, borderColor: skin.border, backgroundColor: skin.bg, opacity: disabled && !loading ? 0.5 : 1 }}
    >
      {loading
        ? <ActivityIndicator size="small" color={skin.fg} />
        : <Text style={[rnText(t.type.bodyStrong), { color: skin.fg }]}>{label}</Text>}
    </TouchableOpacity>
  );
}
