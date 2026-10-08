import React from 'react';
import { Modal as RNModal, View, Text, TouchableOpacity, Pressable, ScrollView, type TextStyle } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { Icon } from './icon';
import type { ModalProps } from './modal';

function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

/** אותו API כמו modal.tsx — גיליון תחתון ב-native. */
export function Modal({ open, onClose, title, subtitle, closeLabel, children }: ModalProps) {
  const t = useTheme();
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: t.color.overlay }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            maxHeight: '90%',
            backgroundColor: t.color.surface,
            borderTopLeftRadius: t.radius.card,
            borderTopRightRadius: t.radius.card,
            borderWidth: 1,
            borderColor: t.color.border,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: t.space[4], gap: t.space[3] }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: t.space[2] }}>
              <View style={{ flex: 1 }}>
                <Text style={[rnText(t.type.sectionTitle), { color: t.color.text, textAlign: 'right' }]}>{title}</Text>
                {!!subtitle && (
                  <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{subtitle}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={onClose}
                accessibilityLabel={closeLabel}
                accessibilityRole="button"
                style={{ width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="x" size="md" tone="muted" />
              </TouchableOpacity>
            </View>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
