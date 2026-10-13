// Feature 19 — URL helpers, kept apart from team-logo-api.ts (which imports axios) so the
// presentational TeamLogo component can be imported anywhere — including tests that run in jsdom
// without a polyfilled axios — without pulling the HTTP client in.

// The `?v=` is the team's `logoUpdatedAt` — it is the cache-buster: the server marks the bytes
// immutable, so a changed logo must be a changed URL.
export function teamLogoPath(teamId: number, version: string | number | null | undefined): string {
  return `/teams/${teamId}/logo${version ? `?v=${encodeURIComponent(String(version))}` : ''}`;
}

/** לוגו לפי טוקן הזמנה — ציבורי, בלי Authorization (המוזמן עוד לא התחבר). */
export function inviteLogoUrl(baseUrl: string, inviteToken: string, version: string | number | null | undefined): string {
  return `${baseUrl}/invites/${encodeURIComponent(inviteToken)}/logo${version ? `?v=${encodeURIComponent(String(version))}` : ''}`;
}

/** מוריד את הלוגו כ-Blob (web) — `<img>` לא יכול לשלוח Authorization, אז מביאים עם fetch ומציגים כ-object URL. */
export async function fetchTeamLogoBlob(baseUrl: string, teamId: number, token: string, version: string | null): Promise<Blob> {
  const res = await fetch(`${baseUrl}${teamLogoPath(teamId, version)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`logo fetch failed: ${res.status}`);
  return res.blob();
}
