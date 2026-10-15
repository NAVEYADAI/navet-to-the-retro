import React from 'react';
import { View, Text, TouchableOpacity, type TextStyle } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
export function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function CardNative({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{ gap: t.space[3], padding: t.space[4], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card, backgroundColor: t.color.surface }}
    >
      {children}
    </View>
  );
}

/** Small pill label (native stand-in for ui/Badge, which is MUI/web only). */
export function PillNative({ label, tone, icon }: { label: string; tone: 'accent' | 'success' | 'neutral'; icon?: 'check' }) {
  const t = useTheme();
  const c = tone === 'accent'
    ? { fg: t.color.accent.base, bg: t.color.accent.subtle, border: t.color.accent.border }
    : t.color.status[tone];
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1], paddingVertical: 3, paddingHorizontal: 9, borderRadius: t.radius.badge, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
      {icon ? <Icon name={icon} size="sm" tone={tone === 'success' ? 'success' : 'accent'} /> : null}
      <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** Secondary / ghost button with a 44pt touch target. The caller's onPress carries the trackEvent. */
export function ActionButtonNative({ label, onPress, variant = 'secondary', testID }: {
  label: string; onPress: () => void; variant?: 'secondary' | 'ghost'; testID?: string;
}) {
  const t = useTheme();
  const ghost = variant === 'ghost';
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[3], alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
        borderRadius: t.radius.field, borderWidth: ghost ? 0 : 1, borderColor: t.color.borderStrong, backgroundColor: ghost ? 'transparent' : t.color.surface,
      }}
    >
      <Text style={[rnText({ ...t.type.label, fontWeight: 600 }), { color: ghost ? t.color.textSecondary : t.color.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}
