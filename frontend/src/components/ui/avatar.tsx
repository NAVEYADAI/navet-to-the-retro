import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { avatarColors } from '@/design/tokens';
import { avatarInitial, type AvatarProps } from './avatar-shared';

export { avatarInitial, type AvatarProps } from './avatar-shared';

/** עיגול עם האות הראשונה של השם. ב-sm יש טבעת בצבע המשטח כדי שהערימה תיראה מופרדת. */
export function Avatar({ name, seed, size = 'md' }: AvatarProps) {
  const t = useTheme();
  const c = avatarColors(t.mode, seed);
  const px = size === 'sm' ? 24 : 36;
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: px,
        height: px,
        boxSizing: 'border-box',
        borderRadius: `${t.radius.pill}px`,
        backgroundColor: c.bg,
        color: c.fg,
        ...(size === 'sm'
          ? { ...t.type.overline, fontWeight: 600, letterSpacing: 0, border: `2px solid ${t.color.surface}` }
          : { ...t.type.bodyStrong, fontFamily: t.type.rowTitle.fontFamily }),
      }}
    >
      {avatarInitial(name)}
    </Box>
  );
}
