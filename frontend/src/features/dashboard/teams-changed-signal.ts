// Tiny pub-sub (same shape as home-signal.ts) so a screen that changes the user's team list from
// elsewhere — currently the global /settings "create team" form — can tell the already-mounted
// Dashboard to refetch. The Dashboard fetches on mount only (see [[feedback-frontend-data-freshness]]),
// and the tab layout keeps it mounted while /settings is open, so without this nothing ever
// refreshed the list after a team was created there (BUG-29). If the Dashboard isn't mounted
// there are no listeners and the next mount fetches fresh anyway.
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeTeamsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyTeamsChanged(): void {
  listeners.forEach((listener) => listener());
}
