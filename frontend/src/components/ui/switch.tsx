import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/design/theme-context';

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

/**
 * מתג ההפעלה/כיבוי היחיד באפליקציה — טרק+כפתור מותאמים לטוקנים, לא MuiSwitch גולמי (שמביא את
 * הכחול והצללים המובנים של MUI ולא מתאים לשפה החזותית של שאר הרכיבים כאן).
 */
export function Switch({ checked, onChange, disabled }: SwitchProps) {
  const t = useTheme();
  return (
    <Box
      component="button"
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      sx={{
        position: 'relative',
        width: 40,
        height: 24,
        flexShrink: 0,
        padding: 0,
        border: 'none',
        borderRadius: `${t.radius.pill}px`,
        backgroundColor: checked ? t.color.accent.base : t.color.borderStrong,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `background-color ${t.motion.fast}`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 3,
          insetInlineStart: checked ? 19 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: t.color.surface,
          boxShadow: t.shadow.sm,
          transition: `inset-inline-start ${t.motion.fast}`,
        }}
      />
    </Box>
  );
}
