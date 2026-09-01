import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/design/theme-context';

export type ThemeColor = 'text' | 'background' | 'backgroundElement' | 'backgroundSelected' | 'textSecondary';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

/** ממפה את מפתחות ה-theme הישנים (5 השדות המתועדים ב-AGENTS.md) לטוקנים החדשים ב-`t.color`. */
export function legacyColor(t: ReturnType<typeof useTheme>, key: ThemeColor): string {
  switch (key) {
    case 'text': return t.color.text;
    case 'background': return t.color.bg;
    case 'backgroundElement': return t.color.surface;
    case 'backgroundSelected': return t.color.surfaceSubtle;
    case 'textSecondary': return t.color.textSecondary;
  }
}

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const t = useTheme();

  return <View style={[{ backgroundColor: legacyColor(t, type ?? 'background') }, style]} {...otherProps} />;
}
