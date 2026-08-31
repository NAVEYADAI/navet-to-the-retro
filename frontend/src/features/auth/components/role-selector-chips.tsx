import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { ROLES } from '@/constants/roles';

interface RoleSelectorChipsProps {
  role: string;
  onSelectRole: (role: string) => void;
}

export function RoleSelectorChips({ role, onSelectRole }: RoleSelectorChipsProps) {
  const t = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, marginBlockStart: `${t.space[1]}px` }}>
      <Typography
        sx={{
          ...t.type.caption,
          fontWeight: 600,
          color: t.color.textSecondary,
          textAlign: 'start',
        }}
      >
        תפקיד מקצועי
      </Typography>
      <Box sx={{ display: 'flex', gap: `${t.space[2]}px`, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {ROLES.map((r) => {
          const isSelected = role === r.value;
          return (
            <Box
              key={r.value}
              component="button"
              type="button"
              onClick={() => onSelectRole(r.value)}
              sx={{
                ...t.type.caption,
                display: 'flex',
                alignItems: 'center',
                gap: `${t.space[1] + 2}px`,
                fontWeight: isSelected ? 700 : 500,
                borderRadius: `${t.radius.pill}px`,
                border: `1.5px solid ${isSelected ? t.color.accent.base : t.color.border}`,
                backgroundColor: isSelected ? t.color.accent.subtle : t.color.surface,
                color: isSelected ? t.color.accent.base : t.color.textSecondary,
                paddingBlock: '7px',
                paddingInline: `${t.space[4]}px`,
                cursor: 'pointer',
                transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}, color ${t.motion.fast}, transform ${t.motion.fast}`,
                '&:hover': {
                  borderColor: isSelected ? t.color.accent.hover : t.color.borderStrong,
                  backgroundColor: isSelected ? t.color.accent.subtle : t.color.surfaceHover,
                },
                '&:active': { transform: 'scale(0.96)' },
              }}
            >
              <Icon name={r.icon} size="sm" tone={isSelected ? 'accent' : 'muted'} />
              {r.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
