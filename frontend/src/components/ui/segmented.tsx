import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/design/theme-context';

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

/** מחליף Tabs, ToggleButtonGroup, ו-Chip נבחר. שימוש אחד לבחירה בלעדית מ-2-4 אפשרויות. */
export function Segmented<T extends string>({ value, onChange, options }: SegmentedProps<T>) {
  const t = useTheme();
  return (
    <Box
      sx={{
        display: 'inline-flex',
        gap: '3px',
        padding: '3px',
        backgroundColor: t.color.surfaceSubtle,
        border: `1px solid ${t.color.border}`,
        borderRadius: `${t.radius.field}px`,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Box
            key={o.value}
            onClick={() => onChange(o.value)}
            sx={{
              ...t.type.label,
              fontFamily: t.type.overline.fontFamily,
              fontWeight: active ? 600 : 500,
              color: active ? t.color.text : t.color.textSecondary,
              backgroundColor: active ? t.color.surface : 'transparent',
              boxShadow: active ? t.shadow.sm : 'none',
              borderRadius: `${t.radius.badge}px`,
              paddingBlock: '6px',
              paddingInline: '14px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}
