import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { fetchOnboardingStatus, postDismissChecklist, postSeenFeatures } from '../onboarding-api';
import { subscribeOnboardingChanged, notifyOnboardingChanged } from '../onboarding-changed-signal';
import { checklistProgress, knownSteps, pickWhatsNew, shouldShowChecklist, stepCta } from '../onboarding-logic';
import { performCta } from '../navigate';
import type { CtaKind, OnboardingStatus, OnboardingStep } from '../types';
import type { FeatureEntry } from '../registry';

export interface OnboardingViewStep extends OnboardingStep {
  /** What the step's button does; 'none' = the step is done inside a team card and has no button. */
  cta: CtaKind;
}

export interface OnboardingState {
  showChecklist: boolean;
  track: OnboardingStatus['track'] | null;
  steps: OnboardingViewStep[];
  progress: { done: number; total: number };
  whatsNew: (FeatureEntry & { effectiveCta: CtaKind }) | null;
  onStepPress: (step: OnboardingViewStep) => void;
  onHideChecklist: () => void;
  onWhatsNewCta: () => void;
  onWhatsNewDismiss: () => void;
}

/**
 * Feature 21 — dashboard onboarding: the starter checklist and the "what's new" card.
 * Loads on mount and whenever `refreshKey` changes (the dashboard's explicit refresh button) —
 * never on focus (project rule). A failed load shows nothing: onboarding is a nudge, not content.
 * `managedTeamId` (first team the user manages, from the dashboard's own teams fetch) is what the
 * "improvement points" CTA opens; without one that CTA simply isn't offered.
 */
export function useOnboarding(token: string | null | undefined, refreshKey = 0, managedTeamId: number | null = null): OnboardingState {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  // §21.0 #15: after the card is closed/clicked the next one waits for the next dashboard entry,
  // so this survives refreshes (the hook stays mounted) but not a remount.
  const [whatsNewClosed, setWhatsNewClosed] = useState(false);
  const shownKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setStatus(await fetchOnboardingStatus(token));
    } catch (err: any) {
      trackEvent('onboarding_load_failed', { status: err?.response?.status ?? 0 });
    }
  }, [token]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => subscribeOnboardingChanged(() => { void load(); }), [load]);

  const showChecklist = shouldShowChecklist(status);
  const feature = whatsNewClosed ? null : pickWhatsNew(status);
  const track = status?.track ?? null;

  // "Shown" is a view event — fired once per key per mount, not on every refresh.
  useEffect(() => {
    if (!feature || !track || shownKeyRef.current === feature.key) return;
    shownKeyRef.current = feature.key;
    trackEvent('whats_new_shown', { featureKey: feature.key, track });
  }, [feature, track]);

  const onStepPress = useCallback((step: OnboardingViewStep) => {
    if (step.cta === 'none') return;
    trackEvent('onboarding_step_clicked', { stepKey: step.key, track: track ?? 'unknown', done: step.done });
    performCta(step.cta, managedTeamId);
  }, [track, managedTeamId]);

  const onHideChecklist = useCallback(() => {
    if (!token || !status) return;
    const { done, total } = checklistProgress(status);
    trackEvent('onboarding_checklist_dismissed', { track: status.track, done, total });
    // Optimistic: hide now; a failed POST just means it shows again next entry.
    setStatus((s) => (s ? { ...s, checklistDismissed: true } : s));
    postDismissChecklist(token).then(() => notifyOnboardingChanged()).catch(() => {});
  }, [token, status]);

  // "Seen" is recorded on close / CTA — never on load, or a refresh would burn the card (§21.0 #4).
  const markSeen = useCallback((key: string) => {
    setWhatsNewClosed(true);
    if (token) postSeenFeatures(token, [key]).catch(() => {});
  }, [token]);

  const onWhatsNewDismiss = useCallback(() => {
    if (!feature) return;
    trackEvent('whats_new_dismissed', { featureKey: feature.key, track: track ?? 'unknown' });
    markSeen(feature.key);
  }, [feature, track, markSeen]);

  const effectiveCta: CtaKind = feature && feature.cta === 'focus-points' && managedTeamId === null ? 'none' : (feature?.cta ?? 'none');

  const onWhatsNewCta = useCallback(() => {
    if (!feature || effectiveCta === 'none') return;
    trackEvent('whats_new_cta_clicked', { featureKey: feature.key, track: track ?? 'unknown' });
    markSeen(feature.key);
    performCta(effectiveCta, managedTeamId);
  }, [feature, effectiveCta, track, managedTeamId, markSeen]);

  const steps: OnboardingViewStep[] = status
    ? knownSteps(status).map((s) => ({ ...s, cta: stepCta(s.key, managedTeamId !== null) }))
    : [];

  return {
    showChecklist,
    track,
    steps,
    progress: status ? checklistProgress(status) : { done: 0, total: 0 },
    whatsNew: feature ? { ...feature, effectiveCta } : null,
    onStepPress,
    onHideChecklist,
    onWhatsNewCta,
    onWhatsNewDismiss,
  };
}
