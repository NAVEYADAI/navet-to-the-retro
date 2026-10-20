import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { trackEvent } from '@/lib/analytics';
import { fetchOnboardingStatus, postGuideStarted } from '../onboarding-api';
import type { OnboardingStatus } from '../types';
import { subscribeAnchorPress, waitForAnchor } from '@/components/ui/guide-anchor';
import { advance, currentStep, goBack, isLastStep, pressTargetOf, startSession, type GuideSession } from './guide-machine';
import { buildGuideContext, filterSteps, scriptFor } from './guide-script';
import { subscribeGuideSignal } from './guide-signals';
import type { GuideId } from './guide-types';

/** After a press / a signal the user sees the result for a moment before the guide moves on. */
const PRESS_DELAY_MS = 350;
const SIGNAL_DELAY_MS = 900;
// The e2e suite (and nothing else) sets this so tests that register fresh users are not interrupted.
const AUTO_START_OFF_KEY = 'guide-auto-start-off';

export type GuideLocation = 'pending' | 'found' | 'missing';

export interface GuideContextValue {
  active: boolean;
  start: (guide: GuideId) => void;
  exit: () => void;
  /** First team the user manages (management track) — the textual tour needs it. */
  managedTeamId: number | null;
}

const inert: GuideContextValue = { active: false, start: () => {}, exit: () => {}, managedTeamId: null };
const GuideCtx = createContext<GuideContextValue>(inert);

export const useGuide = (): GuideContextValue => useContext(GuideCtx);

function autoStartDisabled(): boolean {
  try {
    return Platform.OS === 'web' && typeof localStorage !== 'undefined' && localStorage.getItem(AUTO_START_OFF_KEY) === '1';
  } catch {
    return false;
  }
}

export interface GuideLayerProps {
  session: GuideSession;
  location: GuideLocation;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onExit: () => void;
}

function GuideLayer(props: GuideLayerProps) {
  if (Platform.OS === 'web') {
    const { GuideOverlayWeb } = require('./guide-overlay-web');
    return <GuideOverlayWeb {...props} />;
  }
  const { GuideOverlayNative } = require('./guide-overlay-native');
  return <GuideOverlayNative {...props} />;
}

/**
 * Feature 22: owns the guide's state and drives it — navigates to each step's route, waits for the
 * anchor, listens for the real press / signal that moves a step on, and renders the overlay above
 * the whole app (so it survives navigation between screens). Mounted once, at the layout root.
 */
export function GuideProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [session, setSession] = useState<GuideSession | null>(null);
  const [location, setLocation] = useState<GuideLocation>('pending');
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const sessionRef = useRef<GuideSession | null>(null);
  sessionRef.current = session;
  const statusRef = useRef<OnboardingStatus | null>(null);
  statusRef.current = status;

  const begin = useCallback((guide: GuideId, st: OnboardingStatus | null, auto: boolean) => {
    const ctx = buildGuideContext(st, Platform.OS === 'web' ? 'web' : 'native');
    const next = startSession(guide, filterSteps(scriptFor(guide), ctx), ctx, auto);
    if (!next) return;
    trackEvent('guide_started', { guide, auto });
    setLocation('pending');
    setSession(next);
  }, []);

  // One status read when the app opens: remembers the managed team (for the textual tour) and, for a
  // brand-new user who was never shown it, opens the basic guide — once, ever (guide-started).
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchOnboardingStatus(token);
        if (cancelled) return;
        setStatus(s);
        if (s.guideAutoStart && !autoStartDisabled()) {
          postGuideStarted(token).catch(() => {});
          begin('basic', s, true);
        }
      } catch {
        // No guide is better than a broken screen: the menu button still works.
      }
    })();
    return () => { cancelled = true; };
  }, [token, begin]);

  const start = useCallback((guide: GuideId) => {
    if (!token) return;
    // A fresh read, so "has a sprint now" is true even if the user just made one.
    fetchOnboardingStatus(token)
      .then((s) => { setStatus(s); begin(guide, s, false); })
      .catch(() => begin(guide, statusRef.current, false));
  }, [token, begin]);

  const exit = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    trackEvent('guide_exited', { guide: s.guide, atStep: currentStep(s).id });
    setSession(null);
  }, []);

  const goNext = useCallback((via: 'click' | 'next' | 'signal') => {
    const s = sessionRef.current;
    if (!s) return;
    trackEvent('guide_step_done', { id: currentStep(s).id, guide: s.guide, via });
    if (isLastStep(s)) {
      trackEvent('guide_completed', { guide: s.guide });
      setSession(null);
      return;
    }
    setLocation('pending');
    setSession(advance(s));
  }, []);

  const onNext = useCallback(() => goNext('next'), [goNext]);
  const onBack = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    trackEvent('guide_back', { id: currentStep(s).id, guide: s.guide });
    setLocation('pending');
    setSession(goBack(s));
  }, []);
  const onSkip = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    trackEvent('guide_skipped', { id: currentStep(s).id, guide: s.guide });
    goNext('next');
  }, [goNext]);

  // --- locate the current step: navigate to its route, then wait for its anchor ---
  const stepKey = session ? `${session.guide}:${session.index}` : null;
  useEffect(() => {
    const s = sessionRef.current;
    if (!s) return;
    const step = currentStep(s);
    trackEvent('guide_step_shown', { id: step.id, guide: s.guide });
    const route = step.route?.(s.ctx) ?? null;
    if (route && pathnameRef.current !== route) router.push(route as Href);
    if (!step.anchor) { setLocation('found'); return; }
    let cancelled = false;
    const wait = waitForAnchor(step.anchor);
    wait.promise.then((found) => {
      if (cancelled) return;
      if (!found) trackEvent('guide_anchor_missing', { id: step.id, guide: s.guide });
      setLocation(found ? 'found' : 'missing');
    });
    return () => { cancelled = true; wait.cancel(); };
  }, [stepKey]);

  // --- the real action that moves an interactive step on ---
  useEffect(() => {
    const s = sessionRef.current;
    if (!s || location !== 'found') return;
    const step = currentStep(s);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (ms: number, via: 'click' | 'signal') => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => goNext(via), ms);
    };
    let unsubscribe: (() => void) | undefined;
    const target = pressTargetOf(step);
    if (target) {
      unsubscribe = subscribeAnchorPress(target, () => schedule(PRESS_DELAY_MS, 'click'));
    } else if (step.advanceOn.type === 'signal') {
      const wanted = step.advanceOn.name;
      unsubscribe = subscribeGuideSignal((n) => { if (n === wanted) schedule(SIGNAL_DELAY_MS, 'signal'); });
    }
    return () => { unsubscribe?.(); if (timer) clearTimeout(timer); };
  }, [stepKey, location, goNext]);

  const managedTeamId = status?.track === 'MANAGEMENT' ? (status.hints?.teamId ?? null) : null;
  const value = useMemo<GuideContextValue>(() => ({ active: !!session, start, exit, managedTeamId }), [session, start, exit, managedTeamId]);

  const layer = session
    ? <GuideLayer session={session} location={location} onNext={onNext} onBack={onBack} onSkip={onSkip} onExit={exit} />
    : null;
  return (
    <GuideCtx.Provider value={value}>
      {Platform.OS === 'web' ? (
        <>{children}{layer}</>
      ) : (
        // Native: the overlay is absolutely positioned over a full-size parent that also holds the tabs.
        <View style={{ flex: 1 }}>{children}{layer}</View>
      )}
    </GuideCtx.Provider>
  );
}
