import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import {
  Box,
  Typography,
  Button,
  Chip,
  Switch as MuiSwitch,
  CircularProgress,
  Alert,
  ListItem,
  FormControlLabel,
} from '@mui/material';
import { roles, getRoleLabel, getRoleStyle } from './roles';
import type { TeamListTheme } from '@/features/teams/types';

interface TeamMemberRowProps {
  member: any;
  teamId: number;
  token: string;
  isTeamAdmin: boolean;
  isMe: boolean;
  onChanged: () => void;
  theme: TeamListTheme;
}

export function TeamMemberRow({ member, teamId, token, isTeamAdmin, isMe, onChanged, theme }: TeamMemberRowProps) {
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

  const roleStyle = getRoleStyle(member.role, theme);
  const fullName = member.user?.firstName || member.user?.lastName
    ? `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim()
    : `@${member.user?.username || ''}`;

  return (
    <ListItem
      sx={{
        p: 0,
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        backgroundColor: theme.background,
        borderRadius: 2,
        px: 2,
        py: 1,
        border: '1px solid rgba(0,0,0,0.03)',
      }}
    >
      {isEditing ? (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right', p: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontFamily: 'Rubik, sans-serif' }}>
            עריכת תפקיד עבור: {fullName}
          </Typography>
          {editError && (
            <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
              {editError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 1 }}>
            {roles.map((r) => {
              const isSel = editRole === r.value;
              return (
                <Chip
                  key={r.value}
                  label={r.label}
                  clickable
                  onClick={() => setEditRole(r.value)}
                  sx={{
                    backgroundColor: isSel ? theme.text : theme.backgroundSelected,
                    color: isSel ? theme.background : theme.text,
                    fontFamily: 'Rubik, sans-serif',
                    fontWeight: 'bold',
                  }}
                />
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={editIsAdmin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditIsAdmin(e.target.checked)}
                  disabled={isMe}
                />
              }
              label="הרשאות מנהל (Admin)"
              labelPlacement="start"
              sx={{ m: 0, gap: 1, '& .MuiFormControlLabel-label': { color: theme.text, fontSize: 13, fontFamily: 'Rubik, sans-serif' } }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', gap: 1.5, mt: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={handleSaveEdit}
              disabled={editLoading}
              sx={{ backgroundColor: theme.text, color: theme.background, fontWeight: 'bold', fontFamily: 'Rubik, sans-serif' }}
            >
              {editLoading ? <CircularProgress size={16} color="inherit" /> : 'שמור'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setIsEditing(false)}
              sx={{ borderColor: theme.backgroundSelected, color: theme.text, fontWeight: 'bold', fontFamily: 'Rubik, sans-serif' }}
            >
              ביטול
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {!!removeError && (
            <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
              {removeError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label={getRoleLabel(member.role)}
              size="small"
              sx={{
                backgroundColor: roleStyle.bg,
                color: roleStyle.text,
                fontWeight: 'bold',
                fontSize: 11,
                fontFamily: 'Rubik, sans-serif',
              }}
            />
            {isTeamAdmin && (
              <Button
                size="small"
                onClick={startEdit}
                sx={{
                  color: '#007aff',
                  fontWeight: 'bold',
                  fontSize: 11,
                  fontFamily: 'Rubik, sans-serif',
                  minWidth: 0,
                  minHeight: 36,
                  px: 1,
                }}
              >
                ערוך
              </Button>
            )}
            {isTeamAdmin && !isMe && (
              <Button
                size="small"
                onClick={handleRemove}
                disabled={isRemoving}
                sx={{
                  color: '#c62828',
                  fontWeight: 'bold',
                  fontSize: 11,
                  fontFamily: 'Rubik, sans-serif',
                  minWidth: 0,
                  minHeight: 36,
                  px: 1,
                }}
              >
                {isRemoving ? <CircularProgress size={12} color="inherit" /> : 'הסר'}
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 1 }}>
            {member.isAdmin && (
              <Typography sx={{ fontSize: 13 }} title="מנהל צוות">
                👑
              </Typography>
            )}
            {member.status === 'PENDING' && (
              <Chip
                label={Strings.teamList.pendingMemberBadge}
                size="small"
                sx={{ backgroundColor: '#ede9fe', color: '#6366f1', fontWeight: 'bold', fontSize: 11, fontFamily: 'Rubik, sans-serif' }}
              />
            )}
            <Typography variant="body2" sx={{ color: theme.text, fontWeight: '600', fontFamily: 'Rubik, sans-serif' }}>
              {fullName}
            </Typography>
          </Box>
          </Box>
        </Box>
      )}
    </ListItem>
  );
}
