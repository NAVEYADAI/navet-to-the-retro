import React from 'react';
import { Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { trackEvent } from '@/lib/analytics';
import { useQuickStart } from '@/features/onboarding';
import { CardNative, ButtonNative, MessageNative, rnText } from './settings-native-parts';

const S = Strings.onboarding;

/** Native twin of quick-start-card.tsx (feature 21 §21.0 #13). */
export function QuickStartCardNative() {
  const t = useTheme();
  const { token } = useAuth();
  const q = useQuickStart(token);
  if (!q.loaded) return null;
  const text = q.dismissed ? S.quickStartDismissedText : q.complete ? S.quickStartCompleteText : S.quickStartVisibleText;
  return (
    <CardNative title={S.quickStartTitle} subtitle={S.quickStartSubtitle}>
      {q.error ? <MessageNative text={q.error} isError /> : null}
      <Text testID="quick-start-status" style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>{text}</Text>
      {q.dismissed ? (
        <ButtonNative
          testID="quick-start-restore"
          loading={q.restoring}
          onPress={() => { trackEvent('onboarding_restore_clicked', { screen: 'settings' }); void q.restore(); }}
        >
          {S.quickStartRestoreButton}
        </ButtonNative>
      ) : null}
    </CardNative>
  );
}
