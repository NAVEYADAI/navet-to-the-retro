import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card } from '@/components/ui';
import { getStepText } from '../onboarding-logic';
import type { OnboardingState, OnboardingViewStep } from '../hooks/use-onboarding';

const S = Strings.onboarding;

function StepRow({ step, onPress }: { step: OnboardingViewStep; onPress: (s: OnboardingViewStep) => void }) {
  const t = useTheme();
  const text = getStepText(step.key)!;
  return (
    <Box
      data-testid="onboarding-step"
      data-step-key={step.key}
      data-done={step.done ? 'true' : 'false'}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${t.space[1]}px`,
        padding: `${t.space[3]}px`,
        border: `1px solid ${t.color.border}`,
        borderRadius: `${t.radius.field}px`,
        backgroundColor: step.done ? t.color.surfaceSubtle : t.color.surface,
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
        <Typography sx={{ ...t.type.bodyStrong, color: step.done ? t.color.textSecondary : t.color.text, minWidth: 0 }}>
          {text.title}
        </Typography>
        {step.done ? (
          <Badge tone="success" icon="check">{S.stepDone}</Badge>
        ) : step.optional ? (
          <Badge tone="neutral">{S.stepRecommended}</Badge>
        ) : null}
      </Box>
      {/* Finished steps collapse to the title line — the description and button only matter while pending. */}
      {!step.done ? (
        <>
          <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{text.description}</Typography>
          {step.cta !== 'none' && text.cta ? (
            <Box sx={{ paddingBlockStart: `${t.space[1]}px` }}>
              <Button variant="secondary" size="sm" onPress={() => onPress(step)}>{text.cta}</Button>
            </Box>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}

/** Dashboard starter checklist (feature 21). Renders nothing when hidden, finished or not loaded. */
export function OnboardingChecklistWeb({ onboarding }: { onboarding: OnboardingState }) {
  const t = useTheme();
  if (!onboarding.showChecklist) return null;
  const subtitle = onboarding.track === 'MEMBER' ? S.checklistSubtitleMember : S.checklistSubtitleManagement;
  return (
    <Box data-testid="onboarding-checklist">
      <Card>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, minWidth: 0, flex: '1 1 220px' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
              <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{S.checklistTitle}</Typography>
              <Badge tone="accent">{S.progress(onboarding.progress.done, onboarding.progress.total)}</Badge>
            </Box>
            <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{subtitle}</Typography>
          </Box>
          <Button variant="ghost" size="sm" icon="eye-off" onPress={onboarding.onHideChecklist}>{S.hideButton}</Button>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
          {onboarding.steps.map((step) => (
            <StepRow key={step.key} step={step} onPress={onboarding.onStepPress} />
          ))}
        </Box>
      </Card>
    </Box>
  );
}
