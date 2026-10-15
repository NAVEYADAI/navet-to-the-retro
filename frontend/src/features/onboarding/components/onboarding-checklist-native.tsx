import React from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { getStepText } from '../onboarding-logic';
import type { OnboardingState, OnboardingViewStep } from '../hooks/use-onboarding';
import { ActionButtonNative, CardNative, PillNative, rnText } from './native-parts';

const S = Strings.onboarding;

function StepRowNative({ step, onPress }: { step: OnboardingViewStep; onPress: (s: OnboardingViewStep) => void }) {
  const t = useTheme();
  const text = getStepText(step.key)!;
  return (
    <View
      testID={`onboarding-step-${step.key}`}
      style={{ gap: t.space[1], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field, backgroundColor: step.done ? t.color.surfaceSubtle : t.color.surface }}
    >
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
        <Text style={[rnText(t.type.bodyStrong), { color: step.done ? t.color.textSecondary : t.color.text, textAlign: 'right', flexShrink: 1 }]}>{text.title}</Text>
        {step.done ? <PillNative tone="success" icon="check" label={S.stepDone} /> : step.optional ? <PillNative tone="neutral" label={S.stepRecommended} /> : null}
      </View>
      {!step.done ? (
        <>
          <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{text.description}</Text>
          {step.cta !== 'none' && text.cta ? (
            <ActionButtonNative testID={`onboarding-step-button-${step.key}`} label={text.cta} onPress={() => onPress(step)} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Dashboard starter checklist (feature 21), native. Renders nothing when hidden, finished or not loaded. */
export function OnboardingChecklistNative({ onboarding }: { onboarding: OnboardingState }) {
  const t = useTheme();
  if (!onboarding.showChecklist) return null;
  const subtitle = onboarding.track === 'MEMBER' ? S.checklistSubtitleMember : S.checklistSubtitleManagement;
  return (
    <CardNative testID="onboarding-checklist">
      <View style={{ gap: t.space[1] }}>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right', flexShrink: 1 }]}>{S.checklistTitle}</Text>
          <PillNative tone="accent" label={S.progress(onboarding.progress.done, onboarding.progress.total)} />
        </View>
        <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>{subtitle}</Text>
      </View>
      <View style={{ gap: t.space[2] }}>
        {onboarding.steps.map((step) => (
          <StepRowNative key={step.key} step={step} onPress={onboarding.onStepPress} />
        ))}
      </View>
      <ActionButtonNative testID="onboarding-hide" variant="ghost" label={S.hideButton} onPress={onboarding.onHideChecklist} />
    </CardNative>
  );
}
