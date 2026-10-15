import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, type TextStyle } from 'react-native';
import { useTheme } from '@/design/theme-context';

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
export function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

/** A wrapping row of filter-style pills — the native stand-in for a select (single choice). */
export function PillPickerNative({ label, options, value, onChange }: {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[1] }}>
      {label ? <Text style={[rnText(t.type.label), { color: t.color.textSecondary, textAlign: 'right' }]}>{label}</Text> : null}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={{
                minHeight: t.layout.minTouchTarget, justifyContent: 'center', paddingHorizontal: t.space[3], borderRadius: t.radius.pill, borderWidth: 1,
                borderColor: on ? t.color.accent.base : t.color.borderStrong, backgroundColor: on ? t.color.accent.subtle : t.color.surface,
              }}
            >
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: on ? t.color.accent.base : t.color.text }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function LabeledInputNative({ label, value, onChangeText, multiline, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean; placeholder?: string; keyboardType?: 'default' | 'number-pad';
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[1] }}>
      <Text style={[rnText(t.type.label), { color: t.color.textSecondary, textAlign: 'right' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={t.color.textMuted}
        keyboardType={keyboardType}
        style={[rnText(t.type.body), {
          borderWidth: 1, borderRadius: t.radius.field, paddingHorizontal: t.space[2], paddingVertical: t.space[2], textAlign: 'right',
          color: t.color.text, borderColor: t.color.borderStrong, backgroundColor: t.color.surface,
          minHeight: multiline ? 80 : t.layout.minTouchTarget, textAlignVertical: multiline ? 'top' : 'center',
        }]}
      />
    </View>
  );
}

/** Primary / secondary action button used across the native focus-points screens. */
export function ActionButtonNative({ label, onPress, variant = 'secondary', disabled, loading }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; loading?: boolean;
}) {
  const t = useTheme();
  const isPrimary = variant === 'primary';
  const color = isPrimary ? t.color.accent.onBase : variant === 'danger' ? t.color.status.danger.fg : variant === 'ghost' ? t.color.textSecondary : t.color.text;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[3], alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.field,
        borderWidth: variant === 'ghost' ? 0 : 1, borderColor: isPrimary ? t.color.accent.base : variant === 'danger' ? t.color.status.danger.border : t.color.borderStrong,
        backgroundColor: isPrimary ? t.color.accent.base : 'transparent', opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function CardNative({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[2], padding: t.space[3], borderWidth: 1, borderColor: accent ? t.color.accent.border : t.color.border, borderRadius: t.radius.card, backgroundColor: t.color.surface }}>
      {children}
    </View>
  );
}

export function TextNative({ children, kind = 'body', color, bold }: { children: React.ReactNode; kind?: 'body' | 'caption' | 'title' | 'overline'; color?: string; bold?: boolean }) {
  const t = useTheme();
  const entry = kind === 'title' ? t.type.cardTitle : kind === 'caption' ? t.type.caption : kind === 'overline' ? t.type.overline : t.type.body;
  return (
    <Text style={[rnText(bold ? { ...entry, fontWeight: 700 } : entry), { color: color ?? (kind === 'caption' ? t.color.textSecondary : kind === 'overline' ? t.color.textMuted : t.color.text), textAlign: 'right' }]}>
      {children}
    </Text>
  );
}
