import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import { useTheme } from '@/design/theme-context';

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
export function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

/** Native counterpart of ui/Card (MUI, web only) for the settings screen: title + optional subtitle + children. */
export function CardNative({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.border,
        borderRadius: t.radius.card,
        padding: t.space[5],
        gap: t.space[4],
      }}
    >
      {title ? (
        <View style={{ gap: t.space[1] }}>
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>{title}</Text>
          {subtitle ? (
            <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

/** Native counterpart of ui/Button. The caller supplies `onPress` (which is where trackEvent lives). */
export function ButtonNative({
  children,
  onPress,
  variant = 'secondary',
  disabled,
  loading,
  testID,
}: {
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const skins = {
    primary: { fg: t.color.accent.onBase, bg: t.color.accent.base, border: t.color.accent.base },
    secondary: { fg: t.color.text, bg: t.color.surface, border: t.color.borderStrong },
    danger: { fg: t.color.status.danger.fg, bg: t.color.surface, border: t.color.status.danger.border },
  }[variant];
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
      style={{
        minHeight: t.layout.minTouchTarget,
        paddingHorizontal: t.space[4],
        borderRadius: t.radius.field,
        borderWidth: 1,
        borderColor: inactive ? t.color.border : skins.border,
        backgroundColor: inactive ? t.color.surfaceSubtle : skins.bg,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={t.color.textMuted} />
      ) : (
        <Text style={[rnText({ ...t.type.label, fontWeight: 600 }), { color: inactive ? t.color.textMuted : skins.fg }]}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/** Native counterpart of ui/Field (text / email only). */
export function FieldNative({
  label,
  value,
  onChangeText,
  placeholder,
  email,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  email?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[1] + 2 }}>
      <Text style={[rnText(t.type.label), { color: t.color.textSecondary, textAlign: 'right' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.color.textMuted}
        keyboardType={email ? 'email-address' : 'default'}
        autoCapitalize={email ? 'none' : 'words'}
        autoCorrect={false}
        style={[
          rnText(t.type.body),
          {
            minHeight: t.layout.minTouchTarget,
            borderWidth: 1,
            borderRadius: t.radius.field,
            paddingHorizontal: t.space[3],
            textAlign: 'right',
            color: t.color.text,
            borderColor: t.color.borderStrong,
            backgroundColor: t.color.surface,
          },
        ]}
      />
    </View>
  );
}

/** Inline success/error banner (counterpart of the MUI Alert used by the web cards). */
export function MessageNative({ text, isError }: { text: string; isError: boolean }) {
  const t = useTheme();
  const tone = isError ? t.color.status.danger : t.color.status.success;
  return (
    <View
      accessibilityRole={isError ? 'alert' : undefined}
      style={{ backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border, borderRadius: t.radius.field, padding: t.space[2] }}
    >
      <Text style={[rnText(t.type.caption), { color: tone.fg, textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}
