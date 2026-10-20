import type { GuideSignal } from './guide-types';

// A tiny pub/sub so screens can tell the guide "the user really did X" (a comment was posted)
// without depending on the guide. Emitting with no listener is a no-op.
type Listener = (name: GuideSignal) => void;
const listeners = new Set<Listener>();

export function emitGuideSignal(name: GuideSignal): void {
  listeners.forEach((l) => l(name));
}

export function subscribeGuideSignal(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
