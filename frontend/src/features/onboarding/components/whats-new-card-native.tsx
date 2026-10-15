import React from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import type { OnboardingState } from '../hooks/use-onboarding';
import { ActionButtonNative, CardNative, PillNative, rnText } from './native-parts';

const S = Strings.onboarding;

/** Dashboard "what's new" card (feature 21), native: one feature at a time; seen is recorded on close / CTA only. */
export function WhatsNewCardNative({ onboarding }: { onboarding: OnboardingState }) {
  const t = useTheme();
  const feature = onboarding.whatsNew;
  if (!feature) return null;
  return (
    <CardNative testID="whats-new-card">
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
        <PillNative tone="accent" label={S.whatsNewBadge} />
        {feature.audience === 'MANAGEMENT' ? <PillNative tone="neutral" label={S.managementOnlyBadge} /> : null}
      </View>
      <View style={{ gap: t.space[1] }}>
        <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>{feature.title}</Text>
        <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>{feature.description}</Text>
      </View>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
        {feature.effectiveCta !== 'none' && feature.ctaLabel ? (
          <ActionButtonNative testID="whats-new-cta" label={feature.ctaLabel} onPress={onboarding.onWhatsNewCta} />
        ) : null}
        <ActionButtonNative testID="whats-new-dismiss" variant="ghost" label={S.whatsNewDismissButton} onPress={onboarding.onWhatsNewDismiss} />
      </View>
    </CardNative>
  );
}
