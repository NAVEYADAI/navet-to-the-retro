import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/design/theme-context';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

/** התג היחיד. מצב נמסר בטון סמנטי, לא בצבע מקודד ולא באימוג׳י. */
export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  const t = useTheme();
  const c =
    tone === 'accent'
      ? { fg: t.color.accent.base, bg: t.color.accent.subtle, border: t.color.accent.border }
      : t.color.status[tone];

  return (
    <Box
      component="span"
      sx={{
        ...t.type.caption,
        fontFamily: t.type.overline.fontFamily,
        fontWeight: 600,
        color: c.fg,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: `${t.radius.badge}px`,
        paddingBlock: '3px',
        paddingInline: '9px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
}

export function StatusDot({ tone = 'neutral' }: { tone?: Tone }) {
  const t = useTheme();
  const fg = tone === 'accent' ? t.color.accent.base : t.color.status[tone].fg;
  return <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: fg, flexShrink: 0 }} />;
}
