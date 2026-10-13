import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon, Switch } from '@/components/ui';
import { ROLES } from '@/constants/roles';

interface MemberRoleEditorProps {
  role: string;
  onRoleChange: (role: string) => void;
  isAdmin: boolean;
  onIsAdminChange: (isAdmin: boolean) => void;
  isMe: boolean;
}

/** Role pills + admin switch inside a member row's manage area (admins only). Split out of team-member-row. */
export function MemberRoleEditor({ role, onRoleChange, isAdmin, onIsAdminChange, isMe }: MemberRoleEditorProps) {
  const t = useTheme();
  return (
    <>
      <Box sx={{ display: 'flex', gap: `${t.space[2]}px`, flexWrap: 'wrap' }}>
        {ROLES.map((r) => {
          const selected = role === r.value;
          return (
            <Box
              key={r.value}
              component="button"
              type="button"
              aria-pressed={selected}
              onClick={() => onRoleChange(r.value)}
              sx={{
                ...t.type.caption,
                display: 'flex',
                alignItems: 'center',
                gap: `${t.space[1] + 2}px`,
                fontWeight: selected ? 700 : 500,
                borderRadius: `${t.radius.pill}px`,
                border: `1px solid ${selected ? t.color.accent.border : t.color.border}`,
                backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
                color: selected ? t.color.accent.base : t.color.textSecondary,
                paddingBlock: '7px',
                paddingInline: `${t.space[3]}px`,
                cursor: 'pointer',
                transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}`,
                '&:hover': { borderColor: selected ? t.color.accent.base : t.color.borderStrong },
              }}
            >
              <Icon name={r.icon} size="sm" tone={selected ? 'accent' : 'muted'} />
              {r.label}
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[2]}px` }}>
        <Typography sx={{ ...t.type.body, color: t.color.text }}>{Strings.teamList.teamAdminPrivileges}</Typography>
        <Switch checked={isAdmin} onChange={onIsAdminChange} disabled={isMe} />
      </Box>
    </>
  );
}
