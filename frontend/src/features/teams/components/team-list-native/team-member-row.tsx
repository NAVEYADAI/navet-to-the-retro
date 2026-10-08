import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Avatar, Icon } from '@/components/ui';
import { memberDisplayName } from '@/features/teams/member-display';
import { getRoleLabel } from './roles';
import { ROLES } from '@/constants/roles';
import { trackEvent } from '@/lib/analytics';
import { usePhantomConversionLink, PhantomConversionButton, PhantomConversionPanel } from './phantom-conversion-link';
import { rnText } from './team-settings-panel.styles';

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
}

/**
 * שורת חבר כמו במוקאפ: אווטאר, שם, תפקיד ותגים. הפעולות (תפקיד/הרשאות, קישור הרשמה לפנטום,
 * הסרה) מוסתרות מאחורי כפתור עיפרון אחד ונפתחות מתחת לשורה (אותו מבנה כמו ב-web).
 */
export function TeamMemberRow({ member, teamId, token, isTeamAdmin, isMe, onChanged, canManageTeamContent }: TeamMemberRowProps) {
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

  const fullName = memberDisplayName(member);
  const isPhantom = member.user?.isPhantom === true;
  const isPendingMember = member.status === 'PENDING';
  const isPhantomManageable = isPhantom && !!canManageTeamContent;
  const canManageRow = isTeamAdmin || isPhantomManageable;
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
    setConfirmingRemove(true);
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
        headers: { 'Authorization': `Bearer ${token}` }
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

  const actionButton = (label: string, onPress: () => void, kind: 'primary' | 'secondary' | 'danger', opts: { disabled?: boolean; loading?: boolean } = {}) => {
    const skin = kind === 'primary'
      ? { bg: t.color.accent.base, fg: t.color.accent.onBase, border: t.color.accent.base }
      : kind === 'danger'
        ? { bg: t.color.surface, fg: t.color.status.danger.fg, border: t.color.status.danger.border }
        : { bg: t.color.surface, fg: t.color.text, border: t.color.borderStrong };
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={opts.disabled}
        style={{ minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[4], justifyContent: 'center', alignItems: 'center', borderRadius: t.radius.field, borderWidth: 1, borderColor: skin.border, backgroundColor: skin.bg, opacity: opts.disabled && !opts.loading ? 0.5 : 1 }}
      >
        {opts.loading
          ? <ActivityIndicator size="small" color={skin.fg} />
          : <Text style={[rnText(t.type.bodyStrong), { color: skin.fg }]}>{label}</Text>}
      </TouchableOpacity>
    );
  };

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
            <>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
                {ROLES.map((r) => {
                  const selected = editRole === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      accessibilityState={{ selected }}
                      onPress={() => setEditRole(r.value)}
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: t.space[1],
                        paddingHorizontal: t.space[3],
                        paddingVertical: t.space[1] + 3,
                        borderRadius: t.radius.pill,
                        borderWidth: 1,
                        borderColor: selected ? t.color.accent.border : t.color.border,
                        backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
                      }}
                    >
                      <Icon name={r.icon} size="sm" tone={selected ? 'accent' : 'muted'} />
                      <Text style={[rnText({ ...t.type.caption, fontWeight: selected ? 700 : 500 }), { color: selected ? t.color.accent.base : t.color.textSecondary }]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
                <Text style={[rnText(t.type.body), { color: t.color.text, flexShrink: 1 }]}>{Strings.teamList.teamAdminPrivileges}</Text>
                <Switch
                  value={editIsAdmin}
                  onValueChange={setEditIsAdmin}
                  disabled={isMe}
                  trackColor={{ false: t.color.border, true: t.color.accent.border }}
                  thumbColor={editIsAdmin ? t.color.accent.base : t.color.surface}
                />
              </View>
            </>
          )}

          {confirmingRemove ? (
            <View
              accessibilityRole="alert"
              style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[3], gap: t.space[2] }}
            >
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
                {Strings.teamList.removeMemberConfirmText(fullName)}
              </Text>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
                {actionButton(Strings.teamList.removeMemberConfirmButton, handleRemove, 'danger', { disabled: isRemoving, loading: isRemoving })}
                {actionButton(Strings.teamList.removeMemberCancelButton, handleRemoveCancelled, 'secondary', { disabled: isRemoving })}
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
              {isTeamAdmin && actionButton(Strings.teamList.saveButton, handleSaveEdit, 'primary', { disabled: editLoading, loading: editLoading })}
              {isPhantomManageable && <PhantomConversionButton state={conversion} />}
              {isTeamAdmin && actionButton(Strings.teamList.removeMemberButton, handleRemoveClicked, 'danger', { disabled: isMe || isRemoving })}
            </View>
          )}

          {isPhantomManageable && <PhantomConversionPanel state={conversion} />}
        </View>
      )}
    </View>
  );
}
