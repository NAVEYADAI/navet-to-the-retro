import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';

/**
 * Shared between MemoryCardWeb (components/memory-card-web.tsx) and MemoryCardNative
 * (components/memory-card-native.tsx, product-backlog/08-memory-board.md §8) — comment shape, card sizing, and
 * flip/enlarge state transitions (incl. the trackEvent calls) are identical on both platforms;
 * only the *rendering* (framer-motion vs Animated/LayoutAnimation) and *input handling*
 * (click-timer vs gesture-handler) differ, and stay in each platform file.
 */
export interface MemoryCardComment {
  id: number;
  content: string;
  type: 'KEEP' | 'IMPROVE';
  category?: string | null;
  isAnonymous: boolean;
  author: { username: string; firstName?: string | null; lastName?: string | null };
  createdAt: string;
}

export const MEMORY_CARD_COMPACT_SIZE = 140;
export const MEMORY_CARD_ENLARGED_SIZE = 280;

interface UseMemoryCardFlipOptions {
  /**
   * Fires synchronously inside the same state update that changes isFlipped/isEnlarged, not a
   * render later — lets a platform-specific animation driver (native's Animated.spring /
   * LayoutAnimation) start in lockstep with the state change. Web's framer-motion reacts to
   * isFlipped/isEnlarged directly via `animate`, so it passes neither callback.
   */
  onFlip?: (nextFlipped: boolean) => void;
  onResize?: () => void;
}

export function useMemoryCardFlip(comment: Pick<MemoryCardComment, 'id' | 'type'>, options: UseMemoryCardFlipOptions = {}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);

  const flip = () => {
    setIsFlipped(prev => {
      const next = !prev;
      trackEvent('memory_card_flipped', { commentId: comment.id, type: comment.type, flipped: next });
      options.onFlip?.(next);
      if (!next) {
        options.onResize?.();
        setIsEnlarged(false);
      }
      return next;
    });
  };

  const flipAndEnlarge = () => {
    setIsFlipped(prev => {
      if (!prev) {
        trackEvent('memory_card_flipped', { commentId: comment.id, type: comment.type, flipped: true });
        options.onFlip?.(true);
      }
      return true;
    });
    options.onResize?.();
    setIsEnlarged(prev => {
      const next = !prev;
      trackEvent('memory_card_enlarged', { commentId: comment.id, type: comment.type, enlarged: next });
      return next;
    });
  };

  const size = isEnlarged ? MEMORY_CARD_ENLARGED_SIZE : MEMORY_CARD_COMPACT_SIZE;

  return { isFlipped, isEnlarged, size, flip, flipAndEnlarge };
}
