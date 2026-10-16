import { useCallback, useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { performCta } from '../navigate';
import { getTourSteps } from '../tour-logic';
import type { CtaKind } from '../types';
import type { FeatureEntry } from '../registry';

export interface TourState {
  open: boolean;
  steps: FeatureEntry[];
  index: number;
  step: FeatureEntry;
  /** What the step's button does; 'none' = the step has no button (e.g. needs a team the user doesn't manage). */
  stepCta: CtaKind;
  isFirst: boolean;
  isLast: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNext: () => void;
  onBack: () => void;
  onCta: () => void;
}

/**
 * "סיור במערכת" — a step-by-step tour of the system's features that an existing user opens on demand
 * (no state is stored on the server: it is a viewer, not a one-time announcement). `managedTeamId`
 * is the first team the user manages; it both unlocks the management-only steps and is where the
 * "improvement points" button leads.
 */
export function useTour(managedTeamId: number | null): TourState {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const steps = useMemo(() => getTourSteps(managedTeamId !== null), [managedTeamId]);
  const step = steps[Math.min(index, steps.length - 1)];
  const isFirst = index === 0;
  const isLast = index >= steps.length - 1;
  const stepCta: CtaKind = step.cta === 'focus-points' && managedTeamId === null ? 'none' : step.cta;

  const onOpen = useCallback(() => {
    trackEvent('tour_opened', { steps: steps.length, management: managedTeamId !== null });
    setIndex(0);
    setOpen(true);
  }, [steps.length, managedTeamId]);

  const onClose = useCallback(() => {
    // Closing on the last step counts as finishing; anywhere else it is leaving early.
    trackEvent(isLast ? 'tour_finished' : 'tour_closed', { step: step.key, index });
    setOpen(false);
  }, [isLast, step.key, index]);

  const onNext = useCallback(() => {
    if (isLast) { onClose(); return; }
    trackEvent('tour_step_next', { from: step.key, index });
    setIndex((i) => i + 1);
  }, [isLast, onClose, step.key, index]);

  const onBack = useCallback(() => {
    if (isFirst) return;
    trackEvent('tour_step_back', { from: step.key, index });
    setIndex((i) => i - 1);
  }, [isFirst, step.key, index]);

  const onCta = useCallback(() => {
    if (stepCta === 'none') return;
    trackEvent('tour_cta_clicked', { featureKey: step.key });
    setOpen(false);
    performCta(stepCta, managedTeamId);
  }, [stepCta, step.key, managedTeamId]);

  return { open, steps, index, step, stepCta, isFirst, isLast, onOpen, onClose, onNext, onBack, onCta };
}
