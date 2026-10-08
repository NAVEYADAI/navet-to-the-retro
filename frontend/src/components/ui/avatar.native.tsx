import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { avatarColors } from '@/design/tokens';
import { avatarInitial, type AvatarProps } from './avatar-shared';

export { avatarInitial, type AvatarProps } from './avatar-shared';

/** עיגול עם האות הראשונה של השם. ב-sm יש טבעת בצבע המשטח כדי שהערימה תיראה מופרדת. */
export function Avatar({ name, seed, size = 'md' }: AvatarProps) {
  const t = useTheme();
  const c = avatarColors(t.mode, seed);
  const px = size === 'sm' ? 24 : 36;
  const fontSize = size === 'sm' ? t.type.overline.fontSize : t.type.bodyStrong.fontSize;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: px,
        height: px,
        borderRadius: t.radius.pill,
        backgroundColor: c.bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: size === 'sm' ? 2 : 0,
        borderColor: t.color.surface,
      }}
    >
      <Text style={{ color: c.fg, fontSize, fontWeight: '600' }}>{avatarInitial(name)}</Text>
    </View>
  );
}
