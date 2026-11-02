import React from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { formatDate } from '@/lib/format-date';
import { CardNative, rnText } from '@/features/focus-points/components/native-parts';
import type { WriteAccess } from '../comment-types';

/** Feature 13 §13.2 — native twin of write-access-notice-web.tsx (locked board / "פתוח לך עד …"). */
export function WriteAccessNoticeNative({ access }: { access: WriteAccess | null }) {
  const t = useTheme();
  if (!access) return null;

  if (!access.canWrite) {
    return (
      <View testID="write-locked-notice">
        <CardNative>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
            <Icon name="eye-off" tone="muted" />
            <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right', flexShrink: 1 }]}>{Strings.retroBoard.writeLockedTitle}</Text>
          </View>
          <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.retroBoard.writeLockedBody(access.windowDays)}</Text>
        </CardNative>
      </View>
    );
  }

  if (!access.windowOpen && access.extensionExpiresAt) {
    return (
      <View
        testID="write-extension-notice"
        style={{ gap: t.space[1], padding: t.space[3], backgroundColor: t.color.accent.subtle, borderWidth: 1, borderColor: t.color.accent.border, borderRadius: t.radius.card }}
      >
        <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.base, textAlign: 'right' }]}>{Strings.retroBoard.writeOpenUntil(formatDate(access.extensionExpiresAt))}</Text>
        <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.retroBoard.writeOpenUntilHint}</Text>
      </View>
    );
  }

  return null;
}
