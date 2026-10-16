import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon, Modal } from '@/components/ui';
import type { TourState } from '../hooks/use-tour';
import { ActionButtonNative, PillNative, rnText } from './native-parts';

const S = Strings.onboarding;

/** "סיור במערכת" (native): an icon button for the dashboard header + a stepped bottom sheet. */
export function TourNative({ tour }: { tour: TourState }) {
  const t = useTheme();
  const { step } = tour;
  return (
    <>
      <TouchableOpacity
        testID="tour-open"
        accessibilityRole="button"
        accessibilityLabel={S.tourButton}
        onPress={tour.onOpen}
        style={{ width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="map-pin" size="sm" tone="muted" />
      </TouchableOpacity>
      <Modal open={tour.open} onClose={tour.onClose} title={S.tourTitle} subtitle={S.tourStepOf(tour.index + 1, tour.steps.length)} closeLabel={S.tourClose}>
        <View testID="tour-step" style={{ gap: t.space[3] }}>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
            <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>{step.title}</Text>
            {step.audience === 'MANAGEMENT' ? <PillNative tone="neutral" label={S.managementOnlyBadge} /> : null}
          </View>
          <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>{step.description}</Text>
          {tour.stepCta !== 'none' && step.ctaLabel ? (
            <ActionButtonNative testID="tour-cta" label={step.ctaLabel} onPress={tour.onCta} />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', gap: t.space[1] }}>
          {tour.steps.map((s, i) => (
            <View key={s.key} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === tour.index ? t.color.accent.base : t.color.borderStrong }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
          <ActionButtonNative testID="tour-next" label={tour.isLast ? S.tourFinish : S.tourNext} onPress={tour.onNext} />
          {tour.isFirst ? <View /> : <ActionButtonNative testID="tour-back" variant="ghost" label={S.tourBack} onPress={tour.onBack} />}
        </View>
      </Modal>
    </>
  );
}
