import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Avatar, Icon } from '@/components/ui';
import { memberDisplayName } from '@/features/teams/member-display';
import { getRoleLabel } from './roles';
import { trackEvent } from '@/lib/analytics';
import { usePhantomConversionLink, PhantomConversionButton, PhantomConversionPanel } from './phantom-conversion-link';
import { rnText } from './team-settings-panel.styles';
import { ActionButton } from './action-button';
import { RemoveMemberConfirm } from './remove-member-confirm';
import { MemberRoleEditor } from './member-role-editor';

interface TeamMemberRowProps {
  member: any;
  teamId: number;
  token: string;
  isTeamAdmin: boolean;
  isMe: boolean;
  onChanged: () => void;
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decision #1) —
  // `isAdmin || role === 'TEAM_LEADER'`, NOT the same as `isTeamAdmin` (isAdmin-only) above.
  // Gates the "send registration link" action, distinct from the existing edit/remove actions.
  canManageTeamContent?: boolean;
  // Feature 11 (product-backlog/11-team-leave-and-removal.md §11.0 #1): admins remove anyone, a
  // non-admin team leader only regular members — computed by the card (`canRemoveMember`).
  canRemove?: boolean;
  // Feature 11 §11.0 #3: set only when an admin would be removing the last active team leader.
  newLeaderOptions?: { value: string; label: string }[];
}

/**
 * שורת חבר כמו במוקאפ: אווטאר, שם, תפקיד ותגים. הפעולות (תפקיד/הרשאות, קישור הרשמה לפנטום,
 * הסרה) מוסתרות מאחורי כפתור עיפרון אחד ונפתחות מתחת לשורה (אותו מבנה כמו ב-web).
 */
export function TeamMemberRow({ member, teamId, token, isTeamAdmin, isMe, onChanged, canManageTeamContent, canRemove = false, newLeaderOptions }: TeamMemberRowProps) {
  const t = useTheme();
  const [isManaging, setIsManaging] = useState(false);
  const [editRole, setEditRole] = useState(member.role);
  const [editIsAdmin, setEditIsAdmin] = useState(member.isAdmin);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isRemoving, setIsRemoving] = useState(false);
  // Removing a member is irreversible — "הסר" first opens an inline confirmation (BUG-31).
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [newLeaderId, setNewLeaderId] = useState<string | null>(null);

  const fullName = memberDisplayName(member);
  const isPhantom = member.user?.isPhantom === true;
  const isPendingMember = member.status === 'PENDING';
  const isPhantomManageable = isPhantom && !!canManageTeamContent;
  const canManageRow = isTeamAdmin || isPhantomManageable || canRemove;
  const conversion = usePhantomConversionLink({ teamId, memberId: member.id, token });

  const toggleManage = () => {
    trackEvent('team_member_manage_toggled', { teamId, open: !isManaging });
    if (!isManaging) {
      setEditRole(member.role);
      setEditIsAdmin(member.isAdmin);
      setEditError(null);
      setConfirmingRemove(false);
    }
    setIsManaging(!isManaging);
  };

  const handleSaveEdit = async () => {
    trackEvent('team_member_role_saved', { teamId });
    setEditError(null);
    setEditLoading(true);
    try {
      await axios.patch(`${getBackendUrl()}/teams/${teamId}/members/${member.id}`, {
        role: editRole,
        isAdmin: editIsAdmin
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setIsManaging(false);
      onChanged();
    } catch (err: any) {
      setEditError(err.response?.data?.message || err.message || 'שמירת השינויים נכשלה.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleRemoveClicked = () => {
    trackEvent('team_member_remove_clicked', { teamId });
    setRemoveError(null);
    setNewLeaderId(null);
    setConfirmingRemove(true);
  };

  // Tapping the selected option again clears it — naming a new team leader is optional.
  const handleSelectNewLeader = (id: string) => {
    trackEvent('team_member_remove_new_leader_selected', { teamId, cleared: newLeaderId === id });
    setNewLeaderId(newLeaderId === id ? null : id);
  };

  const handleRemoveCancelled = () => {
    trackEvent('team_member_remove_cancelled', { teamId });
    setConfirmingRemove(false);
  };

  const handleRemove = async () => {
    trackEvent('team_member_remove_confirmed', { teamId });
    setRemoveError(null);
    setIsRemoving(true);
    try {
      await axios.delete(`${getBackendUrl()}/teams/${teamId}/members/${member.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        data: newLeaderId ? { newLeaderMemberId: Number(newLeaderId) } : undefined,
      });
      onChanged();
    } catch (err: any) {
      setRemoveError(err.response?.data?.message || err.message || 'הסרת חבר הצוות נכשלה.');
    } finally {
      setIsRemoving(false);
      setConfirmingRemove(false);
    }
  };

  const badge = (label: string, c: { bg: string; fg: string; border: string }) => (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: t.radius.badge, paddingHorizontal: t.space[2], paddingVertical: 2 }}>
      <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: c.fg }]}>{label}</Text>
    </View>
  );
  const accentBadge = { bg: t.color.accent.subtle, fg: t.color.accent.base, border: t.color.accent.border };

  const errorBox = (text: string) => (
    <View style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[2] }}>
      <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{text}</Text>
    </View>
  );

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: t.color.border }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[3], paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[3], flex: 1, opacity: isPhantom || isPendingMember ? 0.78 : 1 }}>
          <Avatar name={fullName} seed={member.id} />
          <View style={{ flex: 1 }}>
            <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>{fullName}</Text>
            <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{getRoleLabel(member.role)}</Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[1], flexShrink: 1 }}>
            {member.isAdmin && badge(Strings.teamList.adminBadge, accentBadge)}
            {isPhantom && badge(Strings.teamList.phantomBadge, t.color.status.neutral)}
            {isPendingMember && badge(Strings.teamList.pendingMemberBadge, t.color.status.warning)}
          </View>
        </View>

        {canManageRow && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={Strings.teamList.manageMemberLabel(fullName)}
            accessibilityState={{ expanded: isManaging }}
            onPress={toggleManage}
            style={{
              width: t.layout.minTouchTarget,
              height: t.layout.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: t.radius.field,
              borderWidth: 1,
              borderColor: isManaging ? t.color.accent.border : 'transparent',
              backgroundColor: isManaging ? t.color.accent.subtle : 'transparent',
            }}
          >
            <Icon name="edit" size="sm" tone={isManaging ? 'accent' : 'muted'} />
          </TouchableOpacity>
        )}
      </View>

      {isManaging && (
        <View style={{ gap: t.space[3], paddingBottom: t.space[3], paddingRight: 36 + t.space[3] }}>
          {!!editError && errorBox(editError)}
          {!!removeError && errorBox(removeError)}

          {isTeamAdmin && (
            <MemberRoleEditor role={editRole} onRoleChange={setEditRole} isAdmin={editIsAdmin} onIsAdminChange={setEditIsAdmin} isMe={isMe} />
          )}

          {confirmingRemove ? (
            <RemoveMemberConfirm
              fullName={fullName}
              newLeaderOptions={newLeaderOptions}
              newLeaderId={newLeaderId}
              onSelectNewLeader={handleSelectNewLeader}
              isRemoving={isRemoving}
              onConfirm={handleRemove}
              onCancel={handleRemoveCancelled}
            />
          ) : (
            // Left edge (flex-end under row-reverse), "שמור" last so it is the leftmost.
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: t.space[2] }}>
              {canRemove && <ActionButton label={Strings.teamList.removeMemberButton} onPress={handleRemoveClicked} kind="danger" disabled={isRemoving} />}
              {isPhantomManageable && <PhantomConversionButton state={conversion} />}
              {isTeamAdmin && <ActionButton label={Strings.teamList.saveButton} onPress={handleSaveEdit} kind="primary" disabled={editLoading} loading={editLoading} />}
            </View>
          )}

          {isPhantomManageable && <PhantomConversionPanel state={conversion} />}
        </View>
      )}
    </View>
  );
}
