import React from 'react';
import { Box, Button as MuiButton } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Icon, type IconName } from './icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** אייקון מוביל אופציונלי, לצד הטקסט — אף פעם לא במקומו. */
  icon?: IconName;
  /** `submit` בתוך `<form>` כדי לאפשר שליחה במקש Enter מתוך שדה טקסט. */
  type?: 'button' | 'submit';
  /** בטלפון מוצג רק האייקון (הטקסט נשאר כתווית נגישות). דורש `icon` וטקסט מחרוזת. */
  iconOnlyOnMobile?: boolean;
}

const ICON_TONE_BY_VARIANT = {
  primary: 'inverse',
  secondary: 'default',
  ghost: 'muted',
  danger: 'danger',
} as const;

/**
 * הכפתור היחיד באפליקציה. כפתור primary אחד לכל מסך.
 */
export function Button({
  children,
  onPress,
  variant = 'secondary',
  size = 'md',
  disabled,
  loading,
  fullWidth,
  icon,
  type = 'button',
  iconOnlyOnMobile = false,
}: ButtonProps) {
  const t = useTheme();
  const pad = size === 'sm' ? { py: '7px', px: '14px' } : { py: '10px', px: '18px' };
  const fontSize = size === 'sm' ? 13 : 14;

  const skins: Record<Variant, object> = {
    primary: {
      color: t.color.accent.onBase,
      backgroundColor: t.color.accent.base,
      border: `1px solid ${t.color.accent.base}`,
      '&:hover': { backgroundColor: t.color.accent.hover, borderColor: t.color.accent.hover },
    },
    secondary: {
      color: t.color.text,
      backgroundColor: t.color.surface,
      border: `1px solid ${t.color.borderStrong}`,
      '&:hover': { backgroundColor: t.color.surfaceSubtle, borderColor: t.color.textMuted },
    },
    ghost: {
      color: t.color.textSecondary,
      backgroundColor: 'transparent',
      border: '1px solid transparent',
      '&:hover': { backgroundColor: t.color.surfaceSubtle, color: t.color.text },
    },
    danger: {
      color: t.color.status.danger.fg,
      backgroundColor: t.color.surface,
      border: `1px solid ${t.color.status.danger.border}`,
      '&:hover': { backgroundColor: t.color.status.danger.bg, borderColor: t.color.status.danger.fg },
    },
  };

  return (
    <MuiButton
      type={type}
      onClick={onPress}
      aria-label={iconOnlyOnMobile && typeof children === 'string' ? children : undefined}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      disableElevation
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${t.space[1]}px`,
        fontFamily: t.type.bodyStrong.fontFamily,
        fontWeight: 600,
        fontSize,
        textTransform: 'none',
        borderRadius: `${t.radius.field}px`,
        minHeight: t.layout.minTouchTarget - 8,
        paddingBlock: pad.py,
        paddingInline: iconOnlyOnMobile ? { xs: '10px', sm: pad.px } : pad.px,
        minWidth: iconOnlyOnMobile ? { xs: t.layout.minTouchTarget, sm: 64 } : undefined,
        // כפתור ghost (בלי מסגרת ורקע) שנמתח לרוחב ההורה נראה כמו טקסט שצף באמצע רווח ריק — הוא תמיד ברוחב התוכן.
        width: variant === 'ghost' && !fullWidth ? 'fit-content' : undefined,
        boxShadow: 'none',
        transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}`,
        ...skins[variant],
        '&:focus-visible': { outline: `2px solid ${t.color.accent.border}`, outlineOffset: 1 },
        '&.Mui-disabled': {
          color: t.color.textMuted,
          backgroundColor: t.color.surfaceSubtle,
          borderColor: t.color.border,
        },
      }}
    >
      {icon && !loading && (
        <Icon name={icon} size="sm" tone={disabled ? 'muted' : ICON_TONE_BY_VARIANT[variant]} />
      )}
      {loading ? '...' : iconOnlyOnMobile ? <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{children}</Box> : children}
    </MuiButton>
  );
}
