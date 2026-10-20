import type { GuideRect } from '@/components/ui/guide-anchor';

export const HOLE_PADDING = 6;
const MARGIN = 16;
const GAP = 12;

export interface Size { width: number; height: number }
export interface Placement { top: number; left: number }

/** The highlighted area: the anchor's rectangle plus a little air, clipped to the viewport. */
export function holeFor(rect: GuideRect, viewport: Size): GuideRect {
  const left = Math.max(0, rect.x - HOLE_PADDING);
  const top = Math.max(0, rect.y - HOLE_PADDING);
  const right = Math.min(viewport.width, rect.x + rect.width + HOLE_PADDING);
  const bottom = Math.min(viewport.height, rect.y + rect.height + HOLE_PADDING);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Where the bubble goes (§22.0 default #7): below the highlighted area when there is room, else
 * above, else pinned to the bottom of the screen. Horizontally it lines up with the area's right
 * edge (the app is RTL) and is kept inside the screen. No area = centred.
 */
export function placeBubble(hole: GuideRect | null, viewport: Size, bubble: Size): Placement {
  const maxLeft = Math.max(MARGIN, viewport.width - MARGIN - bubble.width);
  const clampLeft = (left: number) => Math.min(Math.max(left, MARGIN), maxLeft);
  if (!hole) {
    return {
      top: Math.max(MARGIN, (viewport.height - bubble.height) / 2),
      left: clampLeft((viewport.width - bubble.width) / 2),
    };
  }
  const left = clampLeft(hole.x + hole.width - bubble.width);
  const below = hole.y + hole.height + GAP;
  if (below + bubble.height <= viewport.height - MARGIN) return { top: below, left };
  const above = hole.y - GAP - bubble.height;
  if (above >= MARGIN) return { top: above, left };
  return { top: Math.max(MARGIN, viewport.height - MARGIN - bubble.height), left };
}

/** Has the highlighted area moved or resized enough to matter (≥ 1px)? */
export function sameRect(a: GuideRect | null, b: GuideRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}
