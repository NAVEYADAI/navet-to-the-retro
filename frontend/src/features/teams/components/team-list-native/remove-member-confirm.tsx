import React from 'react';
import { View, Text } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { rnText } from './team-settings-panel.styles';
import { MemberPicker } from './member-picker';
import { ActionButton } from './action-button';

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
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[3], gap: t.space[2] }}
    >
      <Text style={[rnText(t.type.bodyStrong), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
        {Strings.teamList.removeMemberConfirmText(fullName)}
      </Text>
      {!!newLeaderOptions?.length && (
        <MemberPicker label={Strings.teamList.removeNewLeaderLabel(fullName)} options={newLeaderOptions} selected={newLeaderId} onSelect={onSelectNewLeader} disabled={isRemoving} />
      )}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        <ActionButton label={Strings.teamList.removeMemberConfirmButton} onPress={onConfirm} kind="danger" disabled={isRemoving} loading={isRemoving} />
        <ActionButton label={Strings.teamList.removeMemberCancelButton} onPress={onCancel} kind="secondary" disabled={isRemoving} />
      </View>
    </View>
  );
}
