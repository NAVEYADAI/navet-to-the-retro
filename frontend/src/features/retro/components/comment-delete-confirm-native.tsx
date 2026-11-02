import React from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { ActionButtonNative, rnText } from '@/features/focus-points/components/native-parts';

interface CommentDeleteConfirmNativeProps {
  isModeration: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Feature 13 §13.2 — native twin of comment-delete-confirm-web.tsx: the inline "are you sure". */
export function CommentDeleteConfirmNative({ isModeration, busy, error, onConfirm, onCancel }: CommentDeleteConfirmNativeProps) {
  const t = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ borderTopWidth: 1, borderTopColor: t.color.border, paddingTop: t.space[2], gap: t.space[2] }}>
      <Text style={[rnText(t.type.bodyStrong), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{Strings.retroBoard.deleteConfirmText}</Text>
      {isModeration && <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{Strings.retroBoard.deleteModerationHint}</Text>}
      {!!error && (
        <View style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[2] }}>
          <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{error}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        <ActionButtonNative label={Strings.retroBoard.deleteConfirmButton} variant="danger" onPress={onConfirm} disabled={busy} loading={busy} />
        <ActionButtonNative label={Strings.retroBoard.deleteCancelButton} variant="ghost" onPress={onCancel} disabled={busy} />
      </View>
    </View>
  );
}
