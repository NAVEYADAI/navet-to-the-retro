import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Icon } from '@/components/ui';
import { measureAnchorWeb, scrollAnchorIntoViewWeb, type GuideRect } from '@/components/ui/guide-anchor';
import { currentStep, isFirstStep, isLastStep, isInteractive } from './guide-machine';
import { holeFor, placeBubble, sameRect, type Size } from './guide-layout';
import { GuideDemoBoardWeb } from './guide-demo-board-web';

// react-dom ships no types in this project (same as test-utils/web-dom.tsx); the portal is needed so the
// overlay sits in <body>, above MUI's dialogs — the app root is its own stacking context, below them.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createPortal } = require('react-dom') as { createPortal: (node: React.ReactNode, container: Element) => React.ReactPortal };
import type { GuideLayerProps } from './guide-provider';

const G = Strings.onboarding.guide;
// Above MUI's Dialog (1300): the guide also points at things inside "הוספת חבר".
const Z_DEMO = 1390;
const Z_DIM = 1400;
const Z_BUBBLE = 1410;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Feature 22 overlay (web): four dimming panels around the highlighted element (so the real element
 * stays clickable through the gap), a ring, and the explanation bubble. The area follows the element
 * on every frame — it moves with scrolling, resizing, AnimatedHeight and Collapse alike.
 */
export function GuideOverlayWeb({ session, location, onNext, onBack, onSkip, onExit }: GuideLayerProps) {
  const t = useTheme();
  const step = currentStep(session);
  const copy = (G.steps as Record<string, { title: string; body: string }>)[step.id];
  const [rect, setRect] = useState<GuideRect | null>(null);
  const [viewport, setViewport] = useState<Size>({ width: window.innerWidth, height: window.innerHeight });
  const [bubbleSize, setBubbleSize] = useState<Size>({ width: 340, height: 180 });
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const reduced = prefersReducedMotion();

  const highlighted = !!step.anchor && location === 'found';
  const interactive = isInteractive(step) && location === 'found';

  // Follow the element frame by frame; only re-render when it actually moved.
  useEffect(() => {
    if (!highlighted || !step.anchor) { setRect(null); return; }
    const anchor = step.anchor;
    scrollAnchorIntoViewWeb(anchor);
    let raf = 0;
    let last: GuideRect | null = null;
    const tick = () => {
      const next = measureAnchorWeb(anchor);
      if (!sameRect(last, next)) { last = next; setRect(next); }
      setViewport((v) => (v.width === window.innerWidth && v.height === window.innerHeight ? v : { width: window.innerWidth, height: window.innerHeight }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [highlighted, step.anchor, step.id]);

  useEffect(() => {
    if (highlighted) return;
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [highlighted]);

  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setBubbleSize((b) => (Math.abs(b.width - width) < 1 && Math.abs(b.height - height) < 1 ? b : { width, height }));
  });

  // Esc leaves the guide (and must not also close the dialog the guide is pointing into).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onExit();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onExit]);

  // A new step puts the keyboard on the bubble, so "הבא" / Enter works straight away.
  useEffect(() => {
    bubbleRef.current?.focus({ preventScroll: true });
  }, [step.id]);

  const hole = highlighted && rect ? holeFor(rect, viewport) : null;
  const place = placeBubble(hole, viewport, bubbleSize);
  const bubbleWidth = Math.min(360, viewport.width - 32);
  const move = reduced ? 'none' : 'all 0.2s ease';
  const dim = { position: 'fixed' as const, backgroundColor: t.color.overlay, zIndex: Z_DIM, transition: move };

  // While the target is still loading (a route change, a dialog opening) just keep the screen dimmed.
  const waiting = !!step.anchor && location === 'pending';
  const showNext = !interactive;
  const hint = !interactive ? null : step.advanceOn.type === 'signal' ? G.writeHint : G.actionHint;

  return createPortal(
    <>
      {step.demo ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: Z_DEMO, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: t.space[4], overflowY: 'auto' }}>
          <GuideDemoBoardWeb />
        </div>
      ) : null}

      {hole ? (
        <>
          <div data-testid="guide-dim" style={{ ...dim, top: 0, left: 0, right: 0, height: hole.y }} />
          <div data-testid="guide-dim" style={{ ...dim, top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }} />
          <div data-testid="guide-dim" style={{ ...dim, top: hole.y, left: 0, width: hole.x, height: hole.height }} />
          <div data-testid="guide-dim" style={{ ...dim, top: hole.y, left: hole.x + hole.width, right: 0, height: hole.height }} />
          <div
            data-testid="guide-highlight"
            style={{
              position: 'fixed', zIndex: Z_DIM, pointerEvents: 'none', transition: move,
              top: hole.y, left: hole.x, width: hole.width, height: hole.height,
              border: `2px solid ${t.color.accent.base}`, borderRadius: t.radius.card, boxSizing: 'border-box',
            }}
          />
        </>
      ) : (
        <div data-testid="guide-dim" style={{ ...dim, inset: 0 }} />
      )}

      {waiting ? null : (
      <div
        ref={bubbleRef}
        role="dialog"
        aria-live="polite"
        aria-label={copy.title}
        tabIndex={-1}
        data-testid="guide-bubble"
        data-step-id={step.id}
        data-located={location}
        dir="rtl"
        style={{
          position: 'fixed', zIndex: Z_BUBBLE, top: place.top, left: place.left, width: bubbleWidth, boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: t.space[3], padding: t.space[4], outline: 'none',
          backgroundColor: t.color.surface, border: `1px solid ${t.color.border}`, borderRadius: t.radius.card, boxShadow: t.shadow.md,
          transition: reduced ? 'none' : 'top 0.2s ease, left 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
          <span style={{ ...t.type.caption, color: t.color.textSecondary }}>{G.stepOf(session.index + 1, session.steps.length)}</span>
          <button
            type="button"
            aria-label={G.exit}
            onClick={onExit}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, margin: -t.space[2], background: 'none', border: 0, cursor: 'pointer' }}
          >
            <Icon name="x" size="md" tone="muted" />
          </button>
        </div>
        <h3 style={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{copy.title}</h3>
        <p style={{ ...t.type.body, color: t.color.textSecondary, margin: 0 }}>{copy.body}</p>
        {step.demo ? <p style={{ ...t.type.caption, color: t.color.textSecondary, margin: 0 }}>{G.demoNote}</p> : null}
        {hint ? <p data-testid="guide-hint" style={{ ...t.type.label, color: t.color.accent.base, margin: 0 }}>{hint}</p> : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
          {isFirstStep(session) ? <span /> : <Button variant="ghost" size="sm" onPress={onBack}>{G.back}</Button>}
          {showNext
            ? <Button variant="primary" size="sm" onPress={onNext}>{isLastStep(session) ? G.finish : G.next}</Button>
            : <Button variant="ghost" size="sm" onPress={onSkip}>{G.skipStep}</Button>}
        </div>
      </div>
      )}
    </>,
    document.body,
  );
}
