import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Avatar, Button, Icon, Badge } from '@/components/ui';
import { memberDisplayName } from '@/features/teams/member-display';
import { getRoleLabel } from './roles';
import { trackEvent } from '@/lib/analytics';
import { usePhantomConversionLink, PhantomConversionButton, PhantomConversionPanel } from './phantom-conversion-link';
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
 * הסרה) מוסתרות מאחורי כפתור עיפרון אחד ונפתחות מתחת לשורה, כדי שהרשימה תישאר נקייה.
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

  return (
    <Box component="li" sx={{ listStyle: 'none', borderBlockEnd: `1px solid ${t.color.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[3]}px`, paddingBlock: '10px' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: `${t.space[3]}px`,
            flex: '1 1 auto',
            minWidth: 0,
            opacity: isPhantom || isPendingMember ? 0.78 : 1,
          }}
        >
          <Avatar name={fullName} seed={member.id} />
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0 }}>
            <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, overflowWrap: 'anywhere' }}>
              <bdi>{fullName}</bdi>
            </Typography>
            <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
              {getRoleLabel(member.role)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: `${t.space[1]}px` }}>
            {member.isAdmin && <Badge tone="accent">{Strings.teamList.adminBadge}</Badge>}
            {isPhantom && <Badge tone="neutral">{Strings.teamList.phantomBadge}</Badge>}
            {isPendingMember && <Badge tone="warning">{Strings.teamList.pendingMemberBadge}</Badge>}
          </Box>
        </Box>

        {canManageRow && (
          <Box
            component="button"
            type="button"
            aria-label={Strings.teamList.manageMemberLabel(fullName)}
            aria-expanded={isManaging}
            onClick={toggleManage}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: t.layout.minTouchTarget,
              height: t.layout.minTouchTarget,
              backgroundColor: isManaging ? t.color.accent.subtle : 'transparent',
              border: `1px solid ${isManaging ? t.color.accent.border : 'transparent'}`,
              borderRadius: `${t.radius.field}px`,
              cursor: 'pointer',
              transition: `background-color ${t.motion.fast}`,
              '&:hover': { backgroundColor: isManaging ? t.color.accent.subtle : t.color.surfaceSubtle },
            }}
          >
            <Icon name="edit" size="sm" tone={isManaging ? 'accent' : 'muted'} />
          </Box>
        )}
      </Box>

      {isManaging && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${t.space[3]}px`,
            paddingBlockEnd: `${t.space[3]}px`,
            // מיושר לטקסט של השורה, לא לאווטאר
            paddingInlineStart: `${36 + t.space[3]}px`,
          }}
        >
          {!!editError && <Alert severity="error" sx={{ ...t.type.body }}>{editError}</Alert>}
          {!!removeError && <Alert severity="error" sx={{ ...t.type.body }}>{removeError}</Alert>}

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
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
              {isTeamAdmin && (
                <Button size="sm" variant="primary" onPress={handleSaveEdit} disabled={editLoading} loading={editLoading}>
                  {Strings.teamList.saveButton}
                </Button>
              )}
              {isPhantomManageable && <PhantomConversionButton state={conversion} />}
              {canRemove && (
                <Button size="sm" variant="danger" icon="trash" onPress={handleRemoveClicked} disabled={isRemoving}>
                  {Strings.teamList.removeMemberButton}
                </Button>
              )}
            </Box>
          )}

          {isPhantomManageable && <PhantomConversionPanel state={conversion} />}
        </Box>
      )}
    </Box>
  );
}
