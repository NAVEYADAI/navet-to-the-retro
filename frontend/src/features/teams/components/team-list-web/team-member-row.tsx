import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Avatar, Button, Icon, Badge, Switch } from '@/components/ui';
import { memberDisplayName } from '@/features/teams/member-display';
import { getRoleLabel } from './roles';
import { ROLES } from '@/constants/roles';
import { trackEvent } from '@/lib/analytics';
import { usePhantomConversionLink, PhantomConversionButton, PhantomConversionPanel } from './phantom-conversion-link';

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
 * הסרה) מוסתרות מאחורי כפתור עיפרון אחד ונפתחות מתחת לשורה, כדי שהרשימה תישאר נקייה.
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
            <>
              <Box sx={{ display: 'flex', gap: `${t.space[2]}px`, flexWrap: 'wrap' }}>
                {ROLES.map((r) => {
                  const selected = editRole === r.value;
                  return (
                    <Box
                      key={r.value}
                      component="button"
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setEditRole(r.value)}
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
                <Switch checked={editIsAdmin} onChange={setEditIsAdmin} disabled={isMe} />
              </Box>
            </>
          )}

          {confirmingRemove ? (
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
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
                <Button size="sm" variant="danger" onPress={handleRemove} disabled={isRemoving} loading={isRemoving}>
                  {Strings.teamList.removeMemberConfirmButton}
                </Button>
                <Button size="sm" variant="secondary" onPress={handleRemoveCancelled} disabled={isRemoving}>
                  {Strings.teamList.removeMemberCancelButton}
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
              {isTeamAdmin && (
                <Button size="sm" variant="primary" onPress={handleSaveEdit} disabled={editLoading} loading={editLoading}>
                  {Strings.teamList.saveButton}
                </Button>
              )}
              {isPhantomManageable && <PhantomConversionButton state={conversion} />}
              {isTeamAdmin && (
                <Button size="sm" variant="danger" icon="trash" onPress={handleRemoveClicked} disabled={isMe || isRemoving}>
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
