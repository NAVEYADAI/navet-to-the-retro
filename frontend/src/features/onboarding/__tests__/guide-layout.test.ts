import { HOLE_PADDING, holeFor, placeBubble, sameRect } from '../guide/guide-layout';

const vp = { width: 1000, height: 700 };
const bubble = { width: 340, height: 200 };

describe('guide layout', () => {
  it('pads the highlighted area and clips it to the screen', () => {
    expect(holeFor({ x: 100, y: 100, width: 50, height: 30 }, vp)).toEqual({ x: 100 - HOLE_PADDING, y: 100 - HOLE_PADDING, width: 50 + 2 * HOLE_PADDING, height: 30 + 2 * HOLE_PADDING });
    expect(holeFor({ x: -20, y: 690, width: 100, height: 40 }, vp)).toMatchObject({ x: 0, y: 684, width: 86 });
  });

  it('puts the bubble below the area when there is room, lined up with its right edge (RTL)', () => {
    const hole = { x: 600, y: 100, width: 200, height: 40 };
    expect(placeBubble(hole, vp, bubble)).toEqual({ top: 152, left: 800 - 340 });
  });

  it('goes above when there is no room below, and to the bottom of the screen when neither fits', () => {
    expect(placeBubble({ x: 600, y: 520, width: 200, height: 60 }, vp, bubble).top).toBe(520 - 12 - 200);
    expect(placeBubble({ x: 100, y: 60, width: 800, height: 600 }, vp, bubble).top).toBe(700 - 16 - 200);
  });

  it('keeps the bubble inside the screen horizontally', () => {
    expect(placeBubble({ x: 0, y: 100, width: 40, height: 30 }, vp, bubble).left).toBe(16);
    expect(placeBubble({ x: 990, y: 100, width: 40, height: 30 }, { width: 400, height: 700 }, bubble).left).toBe(400 - 16 - 340);
  });

  it('centres a note that points at nothing', () => {
    expect(placeBubble(null, vp, bubble)).toEqual({ top: 250, left: 330 });
  });

  it('only treats a sub-pixel change as "the same"', () => {
    const r = { x: 10, y: 10, width: 100, height: 40 };
    expect(sameRect(r, { ...r, x: 10.4 })).toBe(true);
    expect(sameRect(r, { ...r, width: 102 })).toBe(false);
    expect(sameRect(r, null)).toBe(false);
    expect(sameRect(null, null)).toBe(true);
  });
});
