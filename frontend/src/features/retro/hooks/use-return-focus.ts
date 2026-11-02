import { useEffect, useRef, type RefObject } from 'react';

/**
 * Feature 13 (web a11y): while a card shows an inline editor / delete confirmation (`active`), keyboard
 * focus lives inside it. When it closes, focus goes back to the card's "⋯" menu button (found by its
 * `aria-haspopup="menu"`), so a keyboard user does not land on <body>. Nothing happens on first render,
 * and a card that was removed (delete confirmed) simply no longer exists.
 */
export function useReturnFocus(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active) {
      containerRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
    }
    wasActive.current = active;
  }, [active, containerRef]);
}
