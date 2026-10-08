import { router, type Href } from 'expo-router';

// BUG-33: the retro board, sprint summary and memory game are real routes (so F5 / Back / shared
// links work). Every navigation to them goes through these helpers so the URL shape lives in one
// place: /team/:teamId/sprint/:sprintId[/summary|/memory].
export type SprintView = 'board' | 'summary' | 'memory';

export function sprintPath(teamId: number | string, sprintId: number | string, view: SprintView = 'board'): string {
  const base = `/team/${teamId}/sprint/${sprintId}`;
  return view === 'board' ? base : `${base}/${view}`;
}

export function openSprint(teamId: number | string, sprintId: number | string, view: SprintView = 'board'): void {
  router.push(sprintPath(teamId, sprintId, view) as Href);
}

/**
 * "Back" inside the app: pops the stack when there is something to pop; after a refresh or a
 * deep link the sprint route is the only entry, so go to `fallback` instead of leaving the app.
 */
export function goBackOr(fallback: string): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as Href);
  }
}
