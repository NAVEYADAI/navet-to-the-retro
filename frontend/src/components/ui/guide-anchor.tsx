import React, { useEffect, useRef } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

// Feature 22 §22.0 default #1: explicit anchors, not a text search. Wrap any element the guide can
// point at in <GuideAnchor name="…">. On web the wrapper is `display: contents` (it has no box, so
// layout is untouched) and the guide measures the union of its children; on native it is a plain
// `View` whose `measureInWindow` gives the rectangle (and which must not be flattened away).
export interface GuideRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type PressListener = (name: string) => void;
const pressListeners = new Set<PressListener>();

function emitPress(name: string): void {
  pressListeners.forEach((l) => l(name));
}

/** Calls `cb` whenever the user presses (clicks / taps) inside the anchor named `name`. */
export function subscribeAnchorPress(name: string, cb: () => void): () => void {
  const listener: PressListener = (n) => { if (n === name) cb(); };
  pressListeners.add(listener);
  return () => { pressListeners.delete(listener); };
}

// ---------- web ----------

function webElement(name: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
}

function unionOfChildren(el: Element): GuideRect | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const visit = (node: Element) => {
    const style = getComputedStyle(node);
    if (style.display === 'none') return;
    if (style.display === 'contents') {
      Array.from(node.children).forEach(visit);
      return;
    }
    const r = node.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    left = Math.min(left, r.left); top = Math.min(top, r.top);
    right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  };
  Array.from(el.children).forEach(visit);
  return left === Infinity ? null : { x: left, y: top, width: right - left, height: bottom - top };
}

/** Web: the anchor's rectangle in viewport coordinates, or null while it is not on screen. */
export function measureAnchorWeb(name: string): GuideRect | null {
  const el = webElement(name);
  return el ? unionOfChildren(el) : null;
}

/** Web: scrolls the anchor into the middle of the viewport if it is not fully visible. */
export function scrollAnchorIntoViewWeb(name: string): void {
  const rect = measureAnchorWeb(name);
  const el = webElement(name);
  if (!rect || !el || typeof window === 'undefined') return;
  const fullyVisible = rect.y >= 0 && rect.y + rect.height <= window.innerHeight;
  if (fullyVisible) return;
  // `display: contents` has no scroll position of its own: scroll its first real child.
  const target = (Array.from(el.children).find((c) => getComputedStyle(c).display !== 'contents') as HTMLElement | undefined) ?? el;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

interface GuideAnchorProps {
  name: string;
  children: React.ReactNode;
  /** Native only: layout for the wrapper View (e.g. `alignSelf` when the child is not full width). */
  style?: StyleProp<ViewStyle>;
}

function GuideAnchorWeb({ name, children }: GuideAnchorProps) {
  return (
    <div data-tour={name} style={{ display: 'contents' }} onClickCapture={() => emitPress(name)}>
      {children}
    </div>
  );
}

// ---------- native ----------

const nativeRefs = new Map<string, React.RefObject<View | null>>();

function GuideAnchorNative({ name, children, style }: GuideAnchorProps) {
  const ref = useRef<View | null>(null);
  useEffect(() => {
    nativeRefs.set(name, ref);
    return () => { if (nativeRefs.get(name) === ref) nativeRefs.delete(name); };
  }, [name]);
  // `onTouchEnd` bubbles from the pressed child, so a tap inside counts as a press of the anchor.
  return (
    <View ref={ref} collapsable={false} style={style} onTouchEnd={() => emitPress(name)}>
      {children}
    </View>
  );
}

/** Native: the anchor's rectangle in window coordinates, or null when it is not mounted / has no size. */
export function measureAnchorNative(name: string): Promise<GuideRect | null> {
  const node = nativeRefs.get(name)?.current;
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => resolve(width === 0 && height === 0 ? null : { x, y, width, height }));
  });
}

// ---------- shared ----------

export const GuideAnchor = Platform.OS === 'web' ? GuideAnchorWeb : GuideAnchorNative;

/** Is the anchor currently mounted (not necessarily visible)? */
export function anchorExists(name: string): boolean {
  return Platform.OS === 'web' ? webElement(name) !== null : nativeRefs.has(name);
}

export async function measureAnchor(name: string): Promise<GuideRect | null> {
  return Platform.OS === 'web' ? measureAnchorWeb(name) : measureAnchorNative(name);
}

/**
 * Waits until the anchor is on screen (mounted AND has a size). Resolves false after `timeoutMs` —
 * the guide then falls back to a centred note instead of leaving the user stuck (§22.0 default #6).
 */
export function waitForAnchor(name: string, timeoutMs = 5000, intervalMs = 100): { promise: Promise<boolean>; cancel: () => void } {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<boolean>((resolve) => {
    const startedAt = Date.now();
    const poll = async () => {
      if (cancelled) { resolve(false); return; }
      if (anchorExists(name) && (await measureAnchor(name))) { resolve(true); return; }
      if (Date.now() - startedAt >= timeoutMs) { resolve(false); return; }
      timer = setTimeout(poll, intervalMs);
    };
    poll();
  });
  return { promise, cancel: () => { cancelled = true; if (timer) clearTimeout(timer); } };
}
