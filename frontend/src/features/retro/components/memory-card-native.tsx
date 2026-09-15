import React, { useRef } from 'react';
import { View, Text, Image, Animated, Platform, LayoutAnimation, UIManager } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { getCommentCategoryLabel, getCommentAuthorName, getPostedByAdminLabel } from '../comment-display';
import { useMemoryCardFlip, type MemoryCardComment } from '../memory-card-flip';

/**
 * SCOPED, DELIBERATE EXCEPTION to UI-GUIDELINES.md §6 ("תנועה" / motion restraint — normally
 * `transition` only on hover/focus/press at 0.15s, no long/entrance animations).
 *
 * Nave explicitly asked for "lots of animation" / a "game feel" for THIS card's flip and
 * enlarge interactions specifically — see product-backlog/08-memory-board.md §8.0, ברירת מחדל טכנית #2. This
 * does NOT extend to the screen/tab transition (mounting <MemoryBoard>, see
 * memory-board-native.tsx) which intentionally has no entrance animation, staying consistent
 * with the rest of the app.
 *
 * A future `ui-migration` pass should NOT "fix" the animation durations below — that would
 * remove the exact effect this feature asked for.
 */
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Re-exported for symmetry with MemoryCardWebComment; the shape now lives in memory-card-flip.ts,
// shared with the web card.
export type MemoryCardNativeComment = MemoryCardComment;

interface MemoryCardNativeProps {
  comment: MemoryCardNativeComment;
}

export function MemoryCardNative({ comment }: MemoryCardNativeProps) {
  const t = useTheme();
  const flipAnim = useRef(new Animated.Value(0)).current; // 0 = showing back, 1 = showing front

  const isKeep = comment.type === 'KEEP';
  const accent = isKeep ? t.color.status.success : t.color.status.danger;
  // Shared with CommentCardWeb (comment-card-web.tsx) / renderCommentCard
  // (sprint-retro-board-native.tsx) — see comment-display.ts.
  const categoryLabel = getCommentCategoryLabel(comment);
  const authorName = getCommentAuthorName(comment);
  const postedByAdminLabel = getPostedByAdminLabel(comment);

  const animateFlip = (toFlipped: boolean) => {
    Animated.spring(flipAnim, { toValue: toFlipped ? 1 : 0, useNativeDriver: Platform.OS !== 'web', speed: 14, bounciness: 8 }).start();
  };

  const animateResize = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(300, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.scaleXY));
  };

  const { isFlipped, isEnlarged, size, flip, flipAndEnlarge } = useMemoryCardFlip(comment, {
    onFlip: animateFlip,
    onResize: animateResize,
  });

  // Standard react-native-gesture-handler pattern for single vs double tap: the single-tap
  // gesture waits for the double-tap gesture to fail before firing, so a real double-tap doesn't
  // also fire the single-tap handler in between.
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => { flipAndEnlarge(); });
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .requireExternalGestureToFail(doubleTapGesture)
    .onEnd(() => { flip(); });
  const composedGesture = Gesture.Exclusive(doubleTapGesture, singleTapGesture);

  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [1, 1, 0, 0] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <GestureDetector gesture={composedGesture}>
      <View
        accessibilityRole="button"
        accessibilityLabel={isFlipped ? undefined : Strings.memoryBoard.flipCardHint}
        style={{ width: size, height: size }}
      >
        {/* Back — deliberately shows NO information at all (no category/type/author), standard
            memory-game convention. See product-backlog/08-memory-board.md §8.0 default #4. */}
        <Animated.View
          pointerEvents="none"
          importantForAccessibility={isFlipped ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={isFlipped}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: backOpacity,
            transform: [{ perspective: 1000 }, { rotateY: backRotate }],
            borderRadius: t.radius.card,
            borderWidth: 2,
            borderColor: t.color.border,
            backgroundColor: t.color.surfaceSubtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={require('../../../../assets/images/app-logo.png')}
            style={{ width: 56, height: 56, opacity: 0.55 }}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          importantForAccessibility={isFlipped ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={!isFlipped}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: frontOpacity,
            transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
            borderRadius: t.radius.card,
            borderWidth: 1,
            borderColor: t.color.border,
            borderRightWidth: 3,
            borderRightColor: accent.fg,
            backgroundColor: t.color.surface,
            padding: t.space[2],
            gap: t.space[1],
          }}
        >
          {!!categoryLabel && (
            <View
              style={{
                alignSelf: 'flex-end',
                backgroundColor: accent.bg,
                borderRadius: t.radius.badge,
                paddingHorizontal: t.space[1] + 2,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: accent.fg, fontSize: 10, fontWeight: '700' }}>{categoryLabel}</Text>
            </View>
          )}
          <Text numberOfLines={isEnlarged ? 10 : 4} style={{ color: t.color.text, fontSize: 12, textAlign: 'right', flexShrink: 1 }}>
            {comment.content}
          </Text>
          <Text style={{ color: t.color.textSecondary, fontSize: 10, fontWeight: comment.isAnonymous ? '400' : '700', textAlign: 'right' }}>
            {authorName}
          </Text>
          {!!postedByAdminLabel && (
            <Text style={{ color: t.color.accent.base, fontSize: 9, fontWeight: '700', textAlign: 'right' }}>
              {postedByAdminLabel}
            </Text>
          )}
          <Text style={{ color: t.color.textMuted, fontSize: 9, textAlign: 'right' }}>
            {`${new Date(comment.createdAt).toLocaleDateString('he-IL')} · ${new Date(comment.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
          </Text>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
