import React from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button } from '@/components/ui';
import { MemberPicker } from './member-picker';

interface RemoveMemberConfirmProps {
  fullName: string;
  /** Set only when an admin is removing the team's last active team leader (feature 11 §11.0 #3). */
  newLeaderOptions?: { value: string; label: string }[];
  newLeaderId: string | null;
  onSelectNewLeader: (id: string) => void;
  isRemoving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Inline "are you sure?" for removing a member (BUG-31), plus the optional next-team-leader pick. */
export function RemoveMemberConfirm({ fullName, newLeaderOptions, newLeaderId, onSelectNewLeader, isRemoving, onConfirm, onCancel }: RemoveMemberConfirmProps) {
  const t = useTheme();
  return (
    <Box
      role="alertdialog"
      aria-label={Strings.teamList.removeMemberConfirmText(fullName)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${t.space[2]}px`,
        padding: `${t.space[3]}px`,
        borderRadius: `${t.radius.field}px`,
        backgroundColor: t.color.status.danger.bg,
        border: `1px solid ${t.color.status.danger.border}`,
      }}
    >
      <Typography sx={{ ...t.type.bodyStrong, color: t.color.status.danger.fg }}>
        {Strings.teamList.removeMemberConfirmText(fullName)}
      </Typography>
      {!!newLeaderOptions?.length && (
        <MemberPicker
          label={Strings.teamList.removeNewLeaderLabel(fullName)}
          options={newLeaderOptions}
          selected={newLeaderId}
          onSelect={onSelectNewLeader}
          disabled={isRemoving}
        />
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
        <Button size="sm" variant="danger" onPress={onConfirm} disabled={isRemoving} loading={isRemoving}>
          {Strings.teamList.removeMemberConfirmButton}
        </Button>
        <Button size="sm" variant="secondary" onPress={onCancel} disabled={isRemoving}>
          {Strings.teamList.removeMemberCancelButton}
        </Button>
      </Box>
    </Box>
  );
}
