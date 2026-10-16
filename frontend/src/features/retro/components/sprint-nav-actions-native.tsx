import React, { useState } from 'react';
import { View, Text, TouchableOpacity, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { animateNextLayout } from '@/lib/animate-layout';
import type { SprintNavAction } from './sprint-nav-actions-web';

function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

/** אותו מבנה כמו sprint-nav-actions-web.tsx — שורת "כלי ספרינט · N" מתקפלת, אריחים עוטפים (3 בשורה). */
export function SprintNavActionsNative({ actions }: { actions: SprintNavAction[] }) {
  const t = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  if (actions.length === 0) return null;
  return (
    <View>
      <TouchableOpacity
        testID="toggle-sprint-tools"
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => { trackEvent('sprint_tools_toggled', { open: !isOpen }); animateNextLayout(); setIsOpen(!isOpen); }}
        style={{ flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: t.space[2], minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[2] }}
      >
        <Icon name="chevron-down" size="sm" tone="muted" rotate={isOpen ? 180 : 0} />
        <Text style={[rnText(t.type.label), { color: t.color.textSecondary }]}>{Strings.retroBoard.toolsToggle(actions.length)}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2], paddingTop: t.space[1] }}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.key}
              onPress={action.onPress}
              accessibilityRole="button"
              style={{
                flexBasis: '31%',
                flexGrow: 1,
                minWidth: 0,
                minHeight: t.layout.minTouchTarget,
                alignItems: 'center',
                justifyContent: 'center',
                gap: t.space[1],
                paddingVertical: t.space[2],
                paddingHorizontal: t.space[1],
                backgroundColor: t.color.surface,
                borderWidth: 1,
                borderColor: t.color.border,
                borderRadius: t.radius.field,
              }}
            >
              <Icon name={action.icon} size="sm" tone="muted" />
              <Text style={[rnText(t.type.label), { color: t.color.text, textAlign: 'center', flexShrink: 1 }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
