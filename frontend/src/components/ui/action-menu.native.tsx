import React, { useState } from 'react';
import { Modal as RNModal, View, Text, TouchableOpacity, Pressable, type TextStyle } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { Icon } from './icon';
import type { ActionMenuProps } from './action-menu';

function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

/** אותו API כמו action-menu.tsx — כפתור "⋯" שפותח גיליון תחתון עם הפעולות. */
export function ActionMenu({ label, items, onOpen }: ActionMenuProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          onOpen?.();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="more" size="md" tone="muted" />
      </TouchableOpacity>
      <RNModal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: t.color.overlay }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: t.color.surface,
              borderTopLeftRadius: t.radius.card,
              borderTopRightRadius: t.radius.card,
              borderWidth: 1,
              borderColor: t.color.border,
              padding: t.space[3],
              paddingBottom: t.space[5],
              gap: t.space[1],
            }}
          >
            <View
              style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: t.radius.pill, backgroundColor: t.color.borderStrong, marginBottom: t.space[2] }}
            />
            {items.map((item, index) => {
              const isDanger = item.tone === 'danger';
              return (
                <TouchableOpacity
                  key={item.key}
                  disabled={item.disabled}
                  onPress={() => {
                    setOpen(false);
                    item.onPress();
                  }}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: t.space[2],
                    minHeight: t.layout.minTouchTarget,
                    paddingHorizontal: t.space[2],
                    borderTopWidth: isDanger && index > 0 ? 1 : 0,
                    borderTopColor: t.color.border,
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                >
                  {item.icon ? <Icon name={item.icon} size="sm" tone={isDanger ? 'danger' : 'muted'} /> : null}
                  <Text style={[rnText(t.type.bodyStrong), { color: isDanger ? t.color.status.danger.fg : t.color.text, textAlign: 'right' }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </RNModal>
    </>
  );
}
