import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { GuideAnchor } from '@/components/ui/guide-anchor';
import { animateNextLayout } from '@/lib/animate-layout';
import { formatDate } from '@/lib/format-date';
import { ActionButtonNative, CardNative, LabeledInputNative, PillPickerNative, rnText } from '@/features/focus-points/components/native-parts';
import { formatUserDisplayName } from '../comment-display';
import type { CategoryOption } from '../comment-types';
import type { useWriteExtensions } from '../hooks/use-write-extensions';

/** Feature 13 §13.0 decision #2 — native twin of write-extensions-panel-web.tsx (admin only). */
export function WriteExtensionsPanelNative({ extensions, memberOptions }: { extensions: ReturnType<typeof useWriteExtensions>; memberOptions: CategoryOption[] }) {
  const t = useTheme();
  const { isOpen, items, isLoading, isSaving, error, grantError, toggle, refresh, grant, revoke } = extensions;
  const [userId, setUserId] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleGrant = async () => {
    if (await grant(userId, endDate)) {
      setUserId('');
      setEndDate('');
    }
  };

  return (
    <GuideAnchor name="board-write-extensions">
      <CardNative>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right', flexShrink: 1 }]}>{Strings.retroBoard.extensionsPanelTitle}</Text>
          <View style={{ flexDirection: 'row-reverse', gap: t.space[1] }}>
            {isOpen && <ActionButtonNative label={Strings.common.refreshButton} variant="ghost" onPress={refresh} disabled={isLoading} />}
            <ActionButtonNative
              label={isOpen ? Strings.retroBoard.adminToolsCloseButton : Strings.retroBoard.adminToolsOpenButton}
              variant="ghost"
              accessibilityLabel={isOpen ? Strings.retroBoard.extensionsPanelCloseLabel : Strings.retroBoard.extensionsPanelOpenLabel}
              expanded={isOpen}
              onPress={() => { animateNextLayout(); toggle(); }}
            />
          </View>
        </View>
        <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{Strings.retroBoard.extensionsPanelHint}</Text>

        {isOpen && (
          <View style={{ gap: t.space[3] }}>
            {!!error && (
              <View style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[2] }}>
                <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{error}</Text>
              </View>
            )}

            <Text style={[rnText(t.type.overline), { color: t.color.textMuted, textAlign: 'right' }]}>{Strings.retroBoard.extensionsActiveHeader}</Text>
            {items.length === 0 ? (
              <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>
                {isLoading ? Strings.retroBoard.extensionsLoading : Strings.retroBoard.extensionsNoneActive}
              </Text>
            ) : items.map((ext) => (
              <View key={ext.id} testID="write-extension" style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>{formatUserDisplayName(ext.user)}</Text>
                  <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.retroBoard.extensionsUntil(formatDate(ext.expiresAt))}</Text>
                </View>
                <ActionButtonNative
                  label={Strings.retroBoard.extensionsRevokeButton}
                  accessibilityLabel={Strings.retroBoard.extensionsRevokeLabel(formatUserDisplayName(ext.user))}
                  variant="danger"
                  onPress={() => revoke(ext.id)}
                  disabled={isSaving}
                />
              </View>
            ))}

            <PillPickerNative label={Strings.retroBoard.extensionsMemberLabel} options={memberOptions} value={userId} onChange={setUserId} />
            <LabeledInputNative
              label={Strings.retroBoard.extensionsEndDateLabel}
              value={endDate}
              onChangeText={setEndDate}
              placeholder={Strings.retroBoard.extensionsDatePlaceholder}
              ltr
            />
            <View style={{ flexDirection: 'row-reverse' }}>
              <ActionButtonNative label={Strings.retroBoard.extensionsGrantButton} onPress={handleGrant} disabled={isSaving} loading={isSaving} />
            </View>
            {!!grantError && (
              <View accessibilityRole="alert" style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[2] }}>
                <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{grantError}</Text>
              </View>
            )}
          </View>
        )}
      </CardNative>
    </GuideAnchor>
  );
}
