import { AccessibilityInfo, LayoutAnimation, Platform, UIManager } from 'react-native';

// Android needs the flag turned on once (same as memory-card-native.tsx).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((enabled) => { reduceMotion = enabled; })
  .catch(() => {});

/**
 * קוראים לזה מיד לפני setState שפותח/סוגר אזור, והפריסה הבאה (כולל מה שמתחתיו) זזה באנימציה.
 * מכבד "הפחתת תנועה" של מערכת ההפעלה.
 */
export function animateNextLayout(durationMs = 220): void {
  if (reduceMotion) return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(durationMs, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );
}
