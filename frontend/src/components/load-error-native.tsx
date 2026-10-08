import React from 'react';
import { View, Text, TouchableOpacity, type TextStyle } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

interface LoadErrorNativeProps {
  message: string;
  onRetry: () => void;
  /** Analytics label of the screen the error belongs to. */
  screen: string;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

/**
 * BUG-34 (native): shown instead of the "nothing here yet" empty state when a screen's initial
 * data load fails, with an explicit retry — mirrors the web screens' error Alert.
 */
export function LoadErrorNative({ message, onRetry, screen }: LoadErrorNativeProps) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: t.color.status.danger.bg,
        borderWidth: 1,
        borderColor: t.color.status.danger.border,
        borderRadius: t.radius.field,
        padding: t.space[3],
        gap: t.space[2],
        alignItems: 'center',
      }}
    >
      <Text style={[rnText(t.type.body), { color: t.color.status.danger.fg, textAlign: 'center' }]}>{message}</Text>
      <TouchableOpacity
        testID="load-error-retry"
        onPress={() => {
          trackEvent('load_error_retry_clicked', { screen });
          onRetry();
        }}
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 4,
          minHeight: t.layout.minTouchTarget,
          paddingHorizontal: t.space[3],
          justifyContent: 'center',
        }}
      >
        <Icon name="refresh" size="sm" tone="danger" />
        <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.status.danger.fg }]}>
          {Strings.common.refreshButton}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
