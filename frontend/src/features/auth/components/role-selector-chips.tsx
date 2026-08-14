import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

interface RoleSelectorChipsProps {
  role: string;
  onSelectRole: (role: string) => void;
  accent: string;
  isDark: boolean;
}

const ROLES = [
  { label: '👑 ראש צוות', value: 'TEAM_LEADER' },
  { label: '🎯 מנהל מוצר', value: 'PRODUCT_MANAGER' },
  { label: '💻 מפתח', value: 'DEVELOPER' },
  { label: '🧪 QA / בודק', value: 'TESTER' },
];

export function RoleSelectorChips({ role, onSelectRole, accent, isDark }: RoleSelectorChipsProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
          fontFamily: 'Rubik, sans-serif',
          fontWeight: 600,
          textAlign: 'right',
        }}
      >
        תפקיד מקצועי
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {ROLES.map((r) => {
          const isSelected = role === r.value;
          return (
            <Chip
              key={r.value}
              label={r.label}
              onClick={() => onSelectRole(r.value)}
              sx={{
                fontFamily: 'Rubik, sans-serif',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: isSelected
                  ? isDark
                    ? 'rgba(129,140,248,0.2)'
                    : 'rgba(99,102,241,0.1)'
                  : isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.03)',
                color: isSelected ? accent : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                border: `1px solid ${
                  isSelected ? accent : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                }`,
                '&:hover': {
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(129,140,248,0.25)'
                      : 'rgba(99,102,241,0.15)'
                    : isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.06)',
                },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
