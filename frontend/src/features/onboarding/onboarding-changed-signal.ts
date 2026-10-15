// Tiny pub-sub (same shape as dashboard/teams-changed-signal.ts): the settings "quick start" card
// restores the checklist while the already-mounted dashboard stays alive, and the dashboard (which
// fetches on mount only) must refetch. With no listener mounted the next mount fetches fresh anyway.
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeOnboardingChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyOnboardingChanged(): void {
  listeners.forEach((listener) => listener());
}
