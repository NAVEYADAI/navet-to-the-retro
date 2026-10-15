import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card } from '@/components/ui';
import type { OnboardingState } from '../hooks/use-onboarding';

const S = Strings.onboarding;

/** Dashboard "what's new" card (feature 21): one feature at a time; seen is recorded on close / CTA only. */
export function WhatsNewCardWeb({ onboarding }: { onboarding: OnboardingState }) {
  const t = useTheme();
  const feature = onboarding.whatsNew;
  if (!feature) return null;
  return (
    <Box data-testid="whats-new-card" data-feature-key={feature.key}>
      <Card>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
          <Badge tone="accent">{S.whatsNewBadge}</Badge>
          {feature.audience === 'MANAGEMENT' ? <Badge tone="neutral">{S.managementOnlyBadge}</Badge> : null}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{feature.title}</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{feature.description}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
          {feature.effectiveCta !== 'none' && feature.ctaLabel ? (
            <Button variant="secondary" size="sm" onPress={onboarding.onWhatsNewCta}>{feature.ctaLabel}</Button>
          ) : null}
          <Button variant="ghost" size="sm" onPress={onboarding.onWhatsNewDismiss}>{S.whatsNewDismissButton}</Button>
        </Box>
      </Card>
    </Box>
  );
}
