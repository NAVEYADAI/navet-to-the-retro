import { Strings } from '@/constants/strings';
import { formatUserDisplayName } from '@/features/retro/comment-display';
import type { FocusPoint, HistoryEntry, PersonRef, RatingWindow, Trend } from './types';

export const MAX_POINT_TEXT = 500;

const S = Strings.focusPoints;

export function trendLabel(trend: Trend | null): string | null {
  if (trend === 'IMPROVED') return S.trendImproved;
  if (trend === 'DECLINED') return S.trendDeclined;
  if (trend === 'SAME') return S.trendSame;
  return null;
}

export function windowLabel(window: RatingWindow): string {
  return window === 'OPEN' ? S.windowOpen : window === 'CLOSED' ? S.windowClosed : S.windowNotOpen;
}

/** One decimal, e.g. 4.5 — the scale is 1-5 so more precision only suggests accuracy that isn't there. */
export function formatScore(score: number | null): string {
  return score === null ? '—' : (Math.round(score * 10) / 10).toString();
}

/** "ממוצע 4.8 · 4 מדרגים · השתפרה", or why there is no result yet. */
export function historyLine(entry: HistoryEntry, resultsHidden: boolean): string {
  const name = entry.sprintName ?? '—';
  if (!entry.closed) return `${name}: ${S.windowStillOpen}`;
  if (resultsHidden) return `${name}: ${S.scoreHiddenSmallTeam}`;
  if (!entry.valid || entry.average === null) return `${name}: ${S.scoreNotEnoughRatings}`;
  const trend = trendLabel(entry.trend);
  return [`${name}: ${formatScore(entry.average)}`, S.ratersCount(entry.raterCount), trend].filter(Boolean).join(' · ');
}

export function personName(person: PersonRef): string {
  return formatUserDisplayName(person);
}

/** Members the task form may assign (active, not still-pending). */
export function assigneeChoices(members: any[] | undefined): { userId: number; label: string }[] {
  return (members || [])
    .filter((m) => m.status !== 'PENDING' && m.user && !m.user.isPhantom)
    .map((m) => ({ userId: m.userId as number, label: formatUserDisplayName(m.user) }));
}

export function kindLabel(kind: FocusPoint['kind']): string {
  return kind === 'KEEP' ? S.kindKeep : S.kindImprove;
}

export function statusLabel(status: FocusPoint['status']): string {
  return status === 'CLOSED' ? S.statusClosed : status === 'ARCHIVED' ? S.statusArchived : S.statusActive;
}

/** A proposal turned into a point: the comment's text, capped to the backend limit. */
export function draftTextFromComment(content: string): string {
  const t = content.trim();
  return t.length > MAX_POINT_TEXT ? `${t.slice(0, MAX_POINT_TEXT - 1).trimEnd()}…` : t;
}

export function errorMessage(err: any, fallback: string): string {
  const m = err?.response?.data?.message;
  return typeof m === 'string' ? m : fallback;
}

/** The sprint the admin screen opens on: the most recently started one. */
export function defaultSprintId(sprints: { id: number; startDate: string }[]): number | null {
  if (sprints.length === 0) return null;
  return [...sprints].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0].id;
}
