import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Modal } from '@/components/ui';
import type { TourState } from '../hooks/use-tour';

const S = Strings.onboarding;

/** "סיור במערכת" (web): a ghost button for the dashboard header + a stepped modal. */
export function TourWeb({ tour }: { tour: TourState }) {
  const t = useTheme();
  const { step } = tour;
  return (
    <>
      <Button variant="ghost" size="sm" icon="map-pin" iconOnlyOnMobile onPress={tour.onOpen}>{S.tourButton}</Button>
      <Modal open={tour.open} onClose={tour.onClose} title={S.tourTitle} subtitle={S.tourStepOf(tour.index + 1, tour.steps.length)} closeLabel={S.tourClose}>
        <Box data-testid="tour-step" data-step-key={step.key} sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
            <Typography component="h3" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{step.title}</Typography>
            {step.audience === 'MANAGEMENT' ? <Badge tone="neutral">{S.managementOnlyBadge}</Badge> : null}
          </Box>
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{step.description}</Typography>
          {tour.stepCta !== 'none' && step.ctaLabel ? (
            <Box><Button variant="secondary" size="sm" onPress={tour.onCta}>{step.ctaLabel}</Button></Box>
          ) : null}
        </Box>
        <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', gap: `${t.space[1]}px` }}>
          {tour.steps.map((s, i) => (
            <Box key={s.key} sx={{ width: 6, height: 6, borderRadius: `${t.radius.pill}px`, backgroundColor: i === tour.index ? t.color.accent.base : t.color.borderStrong }} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
          <Button variant="ghost" size="sm" onPress={tour.onBack} disabled={tour.isFirst}>{S.tourBack}</Button>
          <Button variant="primary" size="sm" onPress={tour.onNext}>{tour.isLast ? S.tourFinish : S.tourNext}</Button>
        </Box>
      </Modal>
    </>
  );
}
