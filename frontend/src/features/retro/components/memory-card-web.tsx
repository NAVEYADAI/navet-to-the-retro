import React, { useRef } from 'react';
import { Image } from 'react-native';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { getCommentCategoryLabel, getCommentAuthorName } from '../comment-display';
import { useMemoryCardFlip, type MemoryCardComment } from '../memory-card-flip';

/**
 * SCOPED, DELIBERATE EXCEPTION to UI-GUIDELINES.md §6 ("תנועה" / motion restraint — normally
 * `transition` only on hover/focus/press at 0.15s, no long/entrance animations).
 *
 * Nave explicitly asked for "lots of animation" / a "game feel" for THIS card's flip and
 * enlarge interactions specifically — see product-backlog/08-memory-board.md §8.0, ברירת מחדל טכנית #2. This
 * does NOT extend to the screen/tab transition (mounting <MemoryBoard>, see memory-board-web.tsx)
 * which intentionally has no Grow/Fade, staying consistent with the rest of the app.
 *
 * A future `ui-migration` pass should NOT "fix" the animation durations below to 0.15s — that
 * would remove the exact effect this feature asked for.
 */
const FLIP_DURATION_S = 0.35;
const SINGLE_CLICK_DELAY_MS = 220;

// Re-exported for the existing test import (`../memory-card-web`); the shape now lives in
// memory-card-flip.ts, shared with the native card.
export type MemoryCardWebComment = MemoryCardComment;

interface MemoryCardWebProps {
  comment: MemoryCardWebComment;
}

export function MemoryCardWeb({ comment }: MemoryCardWebProps) {
  const t = useTheme();
  // Distinguishes a single click from the first half of a double click ourselves — binding both
  // `onClick` and `onDoubleClick` natively fires `click`, `click`, then `dblclick`, which would run
  // the single-click handler twice per real double-click.
  const pendingClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isKeep = comment.type === 'KEEP';
  const accent = isKeep ? t.color.status.success : t.color.status.danger;
  // Shared with CommentCardWeb (comment-card-web.tsx) / renderCommentCard
  // (sprint-retro-board-native.tsx) — see comment-display.ts.
  const categoryLabel = getCommentCategoryLabel(comment);
  const authorName = getCommentAuthorName(comment);
  const { isFlipped, isEnlarged, size, flip, flipAndEnlarge } = useMemoryCardFlip(comment);

  const handleClick = () => {
    if (pendingClickTimer.current) {
      clearTimeout(pendingClickTimer.current);
      pendingClickTimer.current = null;
      flipAndEnlarge();
      return;
    }
    pendingClickTimer.current = setTimeout(() => {
      pendingClickTimer.current = null;
      flip();
    }, SINGLE_CLICK_DELAY_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flip();
    }
  };

  return (
    // NOTE: intentionally NOT using the `layout` prop for the size change (enlarge/shrink).
    // `layout` drives Framer Motion's FLIP technique, which animates size via a CSS `transform:
    // scale(...)` on this element rather than real `width`/`height` — that scale visually
    // stretches/shrinks all descendant content (including the comment text) for the duration of
    // the transition, and if a `layout` transition gets interrupted (e.g. by a fast follow-up
    // click while mid-animation, exactly what a double-click does), the corrective un-scale can
    // get left applied, permanently leaving the text mis-sized after the box itself has already
    // settled at its real size. Animating `width`/`height` directly via `animate` below is a real
    // tween of the box model (true reflow, not a transform), so descendant text can never be left
    // stretched — the tradeoff is that sibling cards no longer slide smoothly out of the way when
    // one enlarges (no shared `layout` group anymore), which is an acceptable cost for genuinely
    // correct text sizing.
    <motion.div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={isFlipped ? undefined : Strings.memoryBoard.flipCardHint}
      initial={false}
      animate={{ width: size, height: size }}
      style={{ zIndex: isEnlarged ? 10 : 1, cursor: 'pointer', flexShrink: 0 }}
      transition={{ duration: FLIP_DURATION_S, ease: 'easeInOut' }}
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%', perspective: '1000px' }}>
        <AnimatePresence initial={false} mode="wait">
          {!isFlipped ? (
            <motion.div
              key="back"
              initial={{ rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: 90, opacity: 0 }}
              transition={{ duration: FLIP_DURATION_S, ease: 'easeInOut' }}
              style={{ position: 'absolute', inset: 0 }}
            >
              {/* Back — deliberately shows NO information at all (no category/type/author),
                  standard memory-game convention. See product-backlog/08-memory-board.md §8.0 default #4. */}
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: `${t.radius.card}px`,
                  backgroundColor: t.color.surfaceSubtle,
                  border: `2px solid ${t.color.border}`,
                  boxShadow: t.shadow.sm,
                }}
              >
                <Image
                  source={require('../../../../assets/images/app-logo.png')}
                  style={{ width: 56, height: 56, opacity: 0.55 }}
                  resizeMode="contain"
                />
              </Box>
            </motion.div>
          ) : (
            <motion.div
              key="front"
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -90, opacity: 0 }}
              transition={{ duration: FLIP_DURATION_S, ease: 'easeInOut' }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${t.space[1]}px`,
                  padding: `${t.space[2]}px`,
                  overflow: 'auto',
                  borderRadius: `${t.radius.card}px`,
                  backgroundColor: t.color.surface,
                  borderInlineStart: `3px solid ${accent.fg}`,
                  border: `1px solid ${t.color.border}`,
                  boxShadow: t.shadow.md,
                  textAlign: 'start',
                }}
              >
                {categoryLabel ? (
                  <Box
                    sx={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      paddingInline: `${t.space[1] + 2}px`,
                      paddingBlock: '2px',
                      borderRadius: `${t.radius.badge}px`,
                      backgroundColor: accent.bg,
                      color: accent.fg,
                      ...t.type.overline,
                    }}
                  >
                    {categoryLabel}
                  </Box>
                ) : null}
                <Typography sx={{ ...t.type.caption, color: t.color.text, flex: 1 }}>
                  {comment.content}
                </Typography>
                <Typography sx={{ ...t.type.caption, fontWeight: comment.isAnonymous ? 400 : 600, color: t.color.textSecondary }}>
                  <bdi>{authorName}</bdi>
                </Typography>
                <Typography sx={{ ...t.type.caption, color: t.color.textMuted, fontSize: 10 }}>
                  <bdi>
                    {new Date(comment.createdAt).toLocaleDateString('he-IL')} · {new Date(comment.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </bdi>
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </motion.div>
  );
}
