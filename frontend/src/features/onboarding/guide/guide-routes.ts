// Routes the guide navigates to. The sprint ones come from lib/sprint-routes (sprintPath); the
// management space has no path helper there (only openFocusPoints, which navigates), so it is
// spelled out here — keep in sync with app/(home)/team/[teamId]/focus-points.
export function openFocusPointsPath(teamId: number | string): string {
  return `/team/${teamId}/focus-points`;
}
