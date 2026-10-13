import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@/design/theme-context';

interface MemberPickerProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

/**
 * Feature 11 — pick one team member (successor admin / new team leader). Pills instead of a
 * `<Field type="select">`: a team is a handful of people, and every option stays visible.
 */
export function MemberPicker({ label, options, selected, onSelect, disabled }: MemberPickerProps) {
  const t = useTheme();
  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
      <Typography sx={{ ...t.type.label, color: t.color.text }}>{label}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
        {options.map((o) => {
          const isSelected = selected === o.value;
          return (
            <Box
              key={o.value}
              component="button"
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelect(o.value)}
              sx={{
                ...t.type.caption,
                fontWeight: isSelected ? 700 : 500,
                borderRadius: `${t.radius.pill}px`,
                border: `1px solid ${isSelected ? t.color.accent.border : t.color.border}`,
                backgroundColor: isSelected ? t.color.accent.subtle : t.color.surface,
                color: isSelected ? t.color.accent.base : t.color.textSecondary,
                paddingBlock: '7px',
                paddingInline: `${t.space[3]}px`,
                // A long username has no break points — keep the pill inside the row and wrap anywhere.
                maxWidth: '100%',
                overflowWrap: 'anywhere',
                textAlign: 'start',
                cursor: disabled ? 'default' : 'pointer',
                transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}`,
                '&:hover': { borderColor: isSelected ? t.color.accent.base : t.color.borderStrong },
              }}
            >
              <bdi>{o.label}</bdi>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
