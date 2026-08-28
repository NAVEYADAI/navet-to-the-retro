import React from 'react';
import { Button as MuiButton } from '@mui/material';
import { useTheme } from '@/design/theme-context';

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
}

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
      onClick={onPress}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      disableElevation
      sx={{
        fontFamily: t.type.bodyStrong.fontFamily,
        fontWeight: 600,
        fontSize,
        textTransform: 'none',
        borderRadius: `${t.radius.field}px`,
        minHeight: t.layout.minTouchTarget - 8,
        paddingBlock: pad.py,
        paddingInline: pad.px,
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
      {loading ? '...' : children}
    </MuiButton>
  );
}
