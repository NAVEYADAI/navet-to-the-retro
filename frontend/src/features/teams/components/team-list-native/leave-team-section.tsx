import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import type { LeaveTeamState } from '@/features/teams/hooks/use-leave-team';
import { rnText } from './team-settings-panel.styles';
import { MemberPicker } from './member-picker';
import { ActionButton } from './action-button';

/** Feature 11 §11.2 — "יציאה מהצוות" at the bottom of the members panel (same flow as web). */
export function LeaveTeamSection({ teamName, state, onDeleteTeam }: { teamName: string; state: LeaveTeamState; onDeleteTeam?: () => void }) {
  const t = useTheme();

  if (!state.isConfirming) {
    return (
      <View style={{ flexDirection: 'row-reverse', paddingVertical: t.space[2] }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={state.open}
          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[2] }}
        >
          <Icon name="log-out" size="sm" tone="muted" />
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.textSecondary }]}>{Strings.teamList.leaveTeamButton}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[3], gap: t.space[3], marginVertical: t.space[2] }}
    >
      <Text style={[rnText(t.type.bodyStrong), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
        {Strings.teamList.leaveConfirmTitle(teamName)}
      </Text>

      {state.lastRealMember ? (
        <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>{Strings.teamList.leaveLastMemberText}</Text>
      ) : (
        <>
          <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>{Strings.teamList.leaveConsequences}</Text>
          {state.needsSuccessor && (
            <MemberPicker label={Strings.teamList.leaveSuccessorLabel} options={state.candidates} selected={state.successorId} onSelect={state.selectSuccessor} disabled={state.isLeaving} />
          )}
          {state.canNameNewLeader && (
            <MemberPicker label={Strings.teamList.newLeaderLabel} options={state.candidates} selected={state.newLeaderId} onSelect={state.selectNewLeader} disabled={state.isLeaving} />
          )}
        </>
      )}

      {!!state.error && (
        <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{state.error}</Text>
      )}

      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        {!state.lastRealMember && (
          <ActionButton label={Strings.teamList.leaveConfirmButton} onPress={state.confirm} kind="danger" disabled={!state.canConfirm} loading={state.isLeaving} />
        )}
        {/* Feature 14: the last real member can't leave, but an admin can delete the team (opens the settings' danger zone). */}
        {state.lastRealMember && onDeleteTeam && (
          <ActionButton label={Strings.teamList.leaveDeleteTeamButton} onPress={onDeleteTeam} kind="danger" />
        )}
        <ActionButton label={Strings.teamList.leaveCancelButton} onPress={state.cancel} kind="secondary" disabled={state.isLeaving} />
      </View>
    </View>
  );
}
