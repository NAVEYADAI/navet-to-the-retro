import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button } from '@/components/ui';
import type { LeaveTeamState } from '@/features/teams/hooks/use-leave-team';
import { MemberPicker } from './member-picker';

/** Feature 11 §11.2 — "יציאה מהצוות" at the bottom of the members panel, with inline confirmation. */
export function LeaveTeamSection({ teamName, state, onDeleteTeam }: { teamName: string; state: LeaveTeamState; onDeleteTeam?: () => void }) {
  const t = useTheme();

  if (!state.isConfirming) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', paddingBlock: `${t.space[2]}px` }}>
        <Button size="sm" variant="ghost" icon="log-out" onPress={state.open}>
          {Strings.teamList.leaveTeamButton}
        </Button>
      </Box>
    );
  }

  return (
    <Box
      role="alertdialog"
      aria-label={Strings.teamList.leaveConfirmTitle(teamName)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${t.space[3]}px`,
        marginBlock: `${t.space[2]}px`,
        padding: `${t.space[3]}px`,
        borderRadius: `${t.radius.field}px`,
        backgroundColor: t.color.status.danger.bg,
        border: `1px solid ${t.color.status.danger.border}`,
      }}
    >
      <Typography sx={{ ...t.type.bodyStrong, color: t.color.status.danger.fg }}>
        {Strings.teamList.leaveConfirmTitle(teamName)}
      </Typography>

      {state.lastRealMember ? (
        <Typography sx={{ ...t.type.body, color: t.color.text }}>{Strings.teamList.leaveLastMemberText}</Typography>
      ) : (
        <>
          <Typography sx={{ ...t.type.body, color: t.color.text }}>{Strings.teamList.leaveConsequences}</Typography>
          {state.needsSuccessor && (
            <MemberPicker
              label={Strings.teamList.leaveSuccessorLabel}
              options={state.candidates}
              selected={state.successorId}
              onSelect={state.selectSuccessor}
              disabled={state.isLeaving}
            />
          )}
          {state.canNameNewLeader && (
            <MemberPicker
              label={Strings.teamList.newLeaderLabel}
              options={state.candidates}
              selected={state.newLeaderId}
              onSelect={state.selectNewLeader}
              disabled={state.isLeaving}
            />
          )}
        </>
      )}

      {!!state.error && <Alert severity="error" sx={{ ...t.type.body }}>{state.error}</Alert>}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
        {!state.lastRealMember && (
          <Button size="sm" variant="danger" onPress={state.confirm} disabled={!state.canConfirm} loading={state.isLeaving}>
            {Strings.teamList.leaveConfirmButton}
          </Button>
        )}
        {/* Feature 14: the last real member can't leave, but an admin can delete the team (opens the settings' danger zone). */}
        {state.lastRealMember && onDeleteTeam && (
          <Button size="sm" variant="danger" icon="trash" onPress={onDeleteTeam}>
            {Strings.teamList.leaveDeleteTeamButton}
          </Button>
        )}
        <Button size="sm" variant="secondary" onPress={state.cancel} disabled={state.isLeaving}>
          {Strings.teamList.leaveCancelButton}
        </Button>
      </Box>
    </Box>
  );
}
