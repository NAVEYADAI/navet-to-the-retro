import { act, renderHook } from '@testing-library/react-native';
import {
  useMemoryCardFlip,
  MEMORY_CARD_COMPACT_SIZE,
  MEMORY_CARD_ENLARGED_SIZE,
} from '../memory-card-flip';

// @testing-library/react-native's `renderHook`/`act` are async here (act's global-environment
// flag restore only resolves once its callback's returned promise settles) — an un-awaited,
// non-async `act(() => ...)` call can leave `result.current` reflecting a stale/interleaved
// render on the *next* interaction. `await act(async () => { ... })` is the reliable pattern,
// confirmed against this exact hook before writing the assertions below.
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
import { trackEvent } from '@/lib/analytics';

const comment = { id: 42, type: 'KEEP' as const };

beforeEach(() => {
  (trackEvent as jest.Mock).mockClear();
});

describe('useMemoryCardFlip', () => {
  it('starts face-down and compact', async () => {
    const { result } = await renderHook(() => useMemoryCardFlip(comment));
    expect(result.current.isFlipped).toBe(false);
    expect(result.current.isEnlarged).toBe(false);
    expect(result.current.size).toBe(MEMORY_CARD_COMPACT_SIZE);
  });

  it('flip() reveals the card and tracks the event, without enlarging', async () => {
    const { result } = await renderHook(() => useMemoryCardFlip(comment));
    await act(async () => { result.current.flip(); });

    expect(result.current.isFlipped).toBe(true);
    expect(result.current.isEnlarged).toBe(false);
    expect(result.current.size).toBe(MEMORY_CARD_COMPACT_SIZE);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('memory_card_flipped', { commentId: 42, type: 'KEEP', flipped: true });
  });

  it('flip() again turns the card back face-down', async () => {
    const { result } = await renderHook(() => useMemoryCardFlip(comment));
    await act(async () => { result.current.flip(); });
    await act(async () => { result.current.flip(); });

    expect(result.current.isFlipped).toBe(false);
    expect(trackEvent).toHaveBeenLastCalledWith('memory_card_flipped', { commentId: 42, type: 'KEEP', flipped: false });
  });

  it('flipping back down also resets an enlarged card to compact', async () => {
    const { result } = await renderHook(() => useMemoryCardFlip(comment));
    await act(async () => { result.current.flipAndEnlarge(); });
    expect(result.current.isEnlarged).toBe(true);

    await act(async () => { result.current.flip(); });

    expect(result.current.isFlipped).toBe(false);
    expect(result.current.isEnlarged).toBe(false);
    expect(result.current.size).toBe(MEMORY_CARD_COMPACT_SIZE);
  });

  it('flipAndEnlarge() from face-down flips, enlarges, and tracks both events exactly once', async () => {
    const { result } = await renderHook(() => useMemoryCardFlip(comment));
    await act(async () => { result.current.flipAndEnlarge(); });

    expect(result.current.isFlipped).toBe(true);
    expect(result.current.isEnlarged).toBe(true);
    expect(result.current.size).toBe(MEMORY_CARD_ENLARGED_SIZE);
    expect(trackEvent).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenCalledWith('memory_card_flipped', { commentId: 42, type: 'KEEP', flipped: true });
    expect(trackEvent).toHaveBeenCalledWith('memory_card_enlarged', { commentId: 42, type: 'KEEP', enlarged: true });
  });

  it('flipAndEnlarge() on an already-flipped card only toggles the enlarge, not the flip', async () => {
    const { result } = await renderHook(() => useMemoryCardFlip(comment));
    await act(async () => { result.current.flip(); }); // flip only, not enlarged
    (trackEvent as jest.Mock).mockClear();

    await act(async () => { result.current.flipAndEnlarge(); });

    expect(result.current.isFlipped).toBe(true);
    expect(result.current.isEnlarged).toBe(true);
    // Card was already flipped, so no second "flipped" event — only the enlarge event.
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('memory_card_enlarged', { commentId: 42, type: 'KEEP', enlarged: true });
  });

  it('flipAndEnlarge() a second time shrinks the card back down while staying flipped', async () => {
    const { result } = await renderHook(() => useMemoryCardFlip(comment));
    await act(async () => { result.current.flipAndEnlarge(); });
    await act(async () => { result.current.flipAndEnlarge(); });

    expect(result.current.isFlipped).toBe(true);
    expect(result.current.isEnlarged).toBe(false);
    expect(result.current.size).toBe(MEMORY_CARD_COMPACT_SIZE);
    expect(trackEvent).toHaveBeenLastCalledWith('memory_card_enlarged', { commentId: 42, type: 'KEEP', enlarged: false });
  });

  it('invokes onFlip and onResize in the order the native card relies on for its animation drivers', async () => {
    const calls: string[] = [];
    const onFlip = jest.fn((next: boolean) => calls.push(`flip:${next}`));
    const onResize = jest.fn(() => calls.push('resize'));
    const { result } = await renderHook(() => useMemoryCardFlip(comment, { onFlip, onResize }));

    await act(async () => { result.current.flipAndEnlarge(); });
    expect(calls).toEqual(['flip:true', 'resize']);

    calls.length = 0;
    await act(async () => { result.current.flip(); }); // flip back down: onFlip(false) then onResize (shrink)
    expect(calls).toEqual(['flip:false', 'resize']);
  });

  it('does not call onResize when flip() reveals a card without shrinking anything', async () => {
    const onFlip = jest.fn();
    const onResize = jest.fn();
    const { result } = await renderHook(() => useMemoryCardFlip(comment, { onFlip, onResize }));

    await act(async () => { result.current.flip(); });

    expect(onFlip).toHaveBeenCalledWith(true);
    expect(onResize).not.toHaveBeenCalled();
  });
});
