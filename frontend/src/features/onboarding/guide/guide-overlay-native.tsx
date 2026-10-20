import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { ActionButtonNative, rnText } from '../components/native-parts';
import { measureAnchorNative, type GuideRect } from '@/components/ui/guide-anchor';
import { GuideDemoBoardNative } from './guide-demo-board-native';
import { holeFor, placeBubble, sameRect, type Size } from './guide-layout';
import { currentStep, isFirstStep, isInteractive, isLastStep } from './guide-machine';
import type { GuideLayerProps } from './guide-provider';

const G = Strings.onboarding.guide;
const POLL_MS = 150;
const noop = () => {};

/**
 * Feature 22 overlay (native): four dimming panels around the highlighted element (the real element
 * stays tappable through the gap), a ring, and the bubble. The element's window rectangle is re-read
 * every 150ms (`measureInWindow`), so scrolling and layout animations are followed.
 */
export function GuideOverlayNative({ session, location, onNext, onBack, onSkip, onExit }: GuideLayerProps) {
  const t = useTheme();
  const window = useWindowDimensions();
  const viewport: Size = { width: window.width, height: window.height };
  const step = currentStep(session);
  const copy = (G.steps as Record<string, { title: string; body: string }>)[step.id];
  const [rect, setRect] = useState<GuideRect | null>(null);
  const [bubbleSize, setBubbleSize] = useState<Size>({ width: 320, height: 200 });

  const highlighted = !!step.anchor && location === 'found';
  const interactive = isInteractive(step) && location === 'found';

  useEffect(() => {
    if (!highlighted || !step.anchor) { setRect(null); return; }
    const anchor = step.anchor;
    let alive = true;
    let last: GuideRect | null = null;
    const read = async () => {
      const next = await measureAnchorNative(anchor);
      if (alive && !sameRect(last, next)) { last = next; setRect(next); }
    };
    read();
    const id = setInterval(read, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [highlighted, step.anchor, step.id]);

  const waiting = !!step.anchor && location === 'pending';
  // An element that is scrolled off the screen can't be pointed at: fall back to the centred note.
  const onScreen = !!rect && rect.y + rect.height > 0 && rect.y < viewport.height;
  const hole = highlighted && rect && onScreen ? holeFor(rect, viewport) : null;
  const place = placeBubble(hole, viewport, bubbleSize);
  const bubbleWidth = Math.min(360, viewport.width - 32);
  const dim = { position: 'absolute' as const, backgroundColor: t.color.overlay };
  const showNext = !interactive;
  const hint = !interactive ? null : step.advanceOn.type === 'signal' ? G.writeHint : G.actionHint;

  return (
    <View testID="guide-overlay" pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}>
      {step.demo ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.color.bg, paddingTop: t.space[7] }]}>
          <GuideDemoBoardNative />
        </View>
      ) : null}

      {hole ? (
        <>
          <Pressable testID="guide-dim" onPress={noop} style={[dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
          <Pressable testID="guide-dim" onPress={noop} style={[dim, { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }]} />
          <Pressable testID="guide-dim" onPress={noop} style={[dim, { top: hole.y, left: 0, width: hole.x, height: hole.height }]} />
          <Pressable testID="guide-dim" onPress={noop} style={[dim, { top: hole.y, left: hole.x + hole.width, right: 0, height: hole.height }]} />
          <View
            testID="guide-highlight"
            pointerEvents="none"
            style={{ position: 'absolute', top: hole.y, left: hole.x, width: hole.width, height: hole.height, borderWidth: 2, borderColor: t.color.accent.base, borderRadius: t.radius.card }}
          />
        </>
      ) : (
        <Pressable testID="guide-dim" onPress={noop} style={[dim, StyleSheet.absoluteFill]} />
      )}

      {waiting ? null : (
        <View
          testID="guide-bubble"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setBubbleSize((b) => (Math.abs(b.width - width) < 1 && Math.abs(b.height - height) < 1 ? b : { width, height }));
          }}
          style={{
            position: 'absolute', top: place.top, left: place.left, width: bubbleWidth, gap: t.space[3], padding: t.space[4],
            backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card,
          }}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[rnText(t.type.caption), { color: t.color.textSecondary }]}>{G.stepOf(session.index + 1, session.steps.length)}</Text>
            <TouchableOpacity
              testID="guide-exit"
              accessibilityRole="button"
              accessibilityLabel={G.exit}
              onPress={onExit}
              style={{ width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, margin: -t.space[2], alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="x" size="md" tone="muted" />
            </TouchableOpacity>
          </View>
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>{copy.title}</Text>
          <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>{copy.body}</Text>
          {step.demo ? <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{G.demoNote}</Text> : null}
          {hint ? <Text testID="guide-hint" style={[rnText(t.type.label), { color: t.color.accent.base, textAlign: 'right' }]}>{hint}</Text> : null}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            {showNext
              ? <ActionButtonNative testID="guide-next" label={isLastStep(session) ? G.finish : G.next} onPress={onNext} />
              : <ActionButtonNative testID="guide-skip" variant="ghost" label={G.skipStep} onPress={onSkip} />}
            {isFirstStep(session) ? <View /> : <ActionButtonNative testID="guide-back" variant="ghost" label={G.back} onPress={onBack} />}
          </View>
        </View>
      )}
    </View>
  );
}
