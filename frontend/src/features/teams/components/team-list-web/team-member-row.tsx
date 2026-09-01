import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import {
  Box,
  Typography,
  Switch as MuiSwitch,
  Alert,
  ListItem,
  FormControlLabel,
} from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Button, Icon, Badge } from '@/components/ui';
import { getRoleLabel } from './roles';
import { ROLES } from '@/constants/roles';

interface TeamMemberRowProps {
  member: any;
  teamId: number;
  token: string;
  isTeamAdmin: boolean;
  isMe: boolean;
  onChanged: () => void;
}

export function TeamMemberRow({ member, teamId, token, isTeamAdmin, isMe, onChanged }: TeamMemberRowProps) {
  const t = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editRole, setEditRole] = useState(member.role);
  const [editIsAdmin, setEditIsAdmin] = useState(member.isAdmin);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const startEdit = () => {
    setEditRole(member.role);
    setEditIsAdmin(member.isAdmin);
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setEditError(null);
    setEditLoading(true);
    try {
      await axios.patch(`${getBackendUrl()}/teams/${teamId}/members/${member.id}`, {
        role: editRole,
        isAdmin: editIsAdmin
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setIsEditing(false);
      onChanged();
    } catch (err: any) {
      setEditError(err.response?.data?.message || err.message || 'שמירת השינויים נכשלה.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleRemove = async () => {
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
    }
  };

  const fullName = member.user?.firstName || member.user?.lastName
    ? `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim()
    : `@${member.user?.username || ''}`;
  const roleBadgeLabel = getRoleLabel(member.role);
  const currentRoleIcon = ROLES.find((r) => r.value === member.role)?.icon;

  return (
    <ListItem
      sx={{
        padding: 0,
        justifyContent: 'space-between',
        backgroundColor: t.color.surface,
        borderRadius: `${t.radius.card}px`,
        paddingInline: `${t.space[3]}px`,
        paddingBlock: `${t.space[2]}px`,
        border: `1px solid ${t.color.border}`,
      }}
    >
      {isEditing ? (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
          <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
            עריכת תפקיד עבור: <bdi>{fullName}</bdi>
          </Typography>
          {editError && (
            <Alert severity="error" sx={{ ...t.type.body }}>
              {editError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px` }}>
            <Typography sx={{ ...t.type.label, color: t.color.textSecondary }}>תפקיד</Typography>
            <Box sx={{ display: 'flex', gap: `${t.space[2]}px`, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {ROLES.map((r) => {
                const selected = editRole === r.value;
                return (
                  <Box
                    key={r.value}
                    component="button"
                    type="button"
                    onClick={() => setEditRole(r.value)}
                    sx={{
                      ...t.type.caption,
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${t.space[1] + 2}px`,
                      fontWeight: selected ? 700 : 500,
                      borderRadius: `${t.radius.pill}px`,
                      border: `1.5px solid ${selected ? t.color.accent.base : t.color.border}`,
                      backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
                      color: selected ? t.color.accent.base : t.color.textSecondary,
                      paddingBlock: '7px',
                      paddingInline: `${t.space[4]}px`,
                      cursor: 'pointer',
                      transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}, color ${t.motion.fast}`,
                      '&:hover': {
                        borderColor: selected ? t.color.accent.hover : t.color.borderStrong,
                        backgroundColor: selected ? t.color.accent.subtle : t.color.surfaceHover,
                      },
                    }}
                  >
                    <Icon name={r.icon} size="sm" tone={selected ? 'accent' : 'muted'} />
                    {r.label}
                  </Box>
                );
              })}
            </Box>
          </Box>

          <FormControlLabel
            control={
              <MuiSwitch
                checked={editIsAdmin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditIsAdmin(e.target.checked)}
                disabled={isMe}
              />
            }
            label={Strings.teamList.teamAdminPrivileges}
            labelPlacement="start"
            sx={{ margin: 0, gap: `${t.space[2]}px`, '& .MuiFormControlLabel-label': { ...t.type.body, color: t.color.text } }}
          />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', gap: `${t.space[2]}px` }}>
            <Button size="sm" variant="primary" onPress={handleSaveEdit} disabled={editLoading} loading={editLoading}>
              {Strings.teamList.saveButton}
            </Button>
            <Button size="sm" variant="secondary" onPress={() => setIsEditing(false)}>
              {Strings.teamList.cancelButton}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
          {!!removeError && (
            <Alert severity="error" sx={{ ...t.type.body }}>
              {removeError}
            </Alert>
          )}
          {/*
            שני clusters נפרדים בטור, לא שורה אחת עם justify-content:space-between+flexWrap.
            עם 4-5 badge/כפתור בצד השני, ה-wrap-כשצריך היה נשבר בנקודה לא-עקבית (תלוי אורך שם/גלגול
            טקסט) ותמיד היה נראה "מלא מדי" גם כשטכנית נכנס בשורה — ראה UI-GUIDELINES §11 "שורת מידע +
            אשכול פעולות".
          */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: `${t.space[2]}px`, flexWrap: 'wrap', minWidth: 0 }}>
              <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
                <bdi>{fullName}</bdi>
              </Typography>
              {member.status === 'PENDING' && <Badge tone="accent">{Strings.teamList.pendingMemberBadge}</Badge>}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: `${t.space[2]}px`, flexWrap: 'wrap' }}>
              {member.isAdmin && <Badge tone="neutral">{Strings.teamList.adminBadge}</Badge>}
              <Box
                sx={{
                  ...t.type.caption,
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${t.space[1] + 2}px`,
                  fontWeight: 700,
                  borderRadius: `${t.radius.pill}px`,
                  border: `1.5px solid ${t.color.accent.base}`,
                  backgroundColor: t.color.accent.subtle,
                  color: t.color.accent.base,
                  paddingBlock: '7px',
                  paddingInline: `${t.space[4]}px`,
                }}
              >
                {currentRoleIcon ? <Icon name={currentRoleIcon} size="sm" tone="accent" /> : null}
                {roleBadgeLabel}
              </Box>
              {isTeamAdmin && (
                <Button size="sm" variant="ghost" icon="edit" onPress={startEdit}>
                  ערוך
                </Button>
              )}
              {isTeamAdmin && (
                <Button size="sm" variant="danger" icon="trash" onPress={handleRemove} disabled={isMe || isRemoving} loading={isRemoving}>
                  הסר
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </ListItem>
  );
}
