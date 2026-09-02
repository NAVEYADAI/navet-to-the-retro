// Tiny pub-sub so the navbar (app-tabs.web.tsx) can tell the Dashboard to drop back to the team
// list even when it's already on the "/" route — e.g. deep inside a sprint's retro board, which
// is local component state (`activeView==='retro'`), not a separate route, so a normal nav click
// on "ראשי" has nothing to navigate to and does nothing. Double-clicking "ראשי" fires this signal
// instead. See HIDDEN-DETAILS.md for the user-facing writeup of this shortcut.
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeGoHome(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function triggerGoHome(): void {
  listeners.forEach((listener) => listener());
}
