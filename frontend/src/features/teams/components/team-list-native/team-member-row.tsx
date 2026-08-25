import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { nativeStyles } from './styles';
import { roles, getRoleLabel } from './roles';
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

  if (isEditing) {
    return (
      <View style={nativeStyles.memberListItem}>
        <View style={nativeStyles.editMemberPane}>
          <ThemedText style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right' }}>
            {Strings.teamList.editMemberHeader(member.user?.username)}
          </ThemedText>

          {!!editError && (
            <View style={nativeStyles.errorBannerInline}>
              <ThemedText style={nativeStyles.errorTextInline}>{editError}</ThemedText>
            </View>
          )}

          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>
            {roles.map((r) => {
              const selected = editRole === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    nativeStyles.roleOptionBtn,
                    { backgroundColor: selected ? theme.backgroundSelected : theme.background }
                  ]}
                  onPress={() => setEditRole(r.value)}
                >
                  <ThemedText style={{ fontSize: 11, fontWeight: selected ? 'bold' : 'normal' }}>
                    {r.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.two, marginTop: 4 }}>
            <ThemedText style={{ fontSize: 12 }}>{Strings.teamList.teamAdminPrivileges}</ThemedText>
            <Switch
              value={editIsAdmin}
              onValueChange={setEditIsAdmin}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={editIsAdmin ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>

          <View style={{ flexDirection: 'row-reverse', gap: Spacing.two, marginTop: 6 }}>
            <TouchableOpacity
              style={[nativeStyles.actionSaveBtn, { backgroundColor: theme.text }]}
              onPress={handleSaveEdit}
              disabled={editLoading}
            >
              {editLoading ? (
                <ActivityIndicator size="small" color={theme.background} />
              ) : (
                <ThemedText style={{ color: theme.background, fontSize: 12, fontWeight: 'bold' }}>
                  {Strings.teamList.saveButton}
                </ThemedText>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[nativeStyles.actionCancelBtn, { backgroundColor: theme.backgroundSelected }]}
              onPress={() => setIsEditing(false)}
            >
              <ThemedText style={{ fontSize: 12 }}>{Strings.teamList.cancelButton}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={nativeStyles.memberListItem}>
      {!!removeError && (
        <View style={nativeStyles.errorBannerInline}>
          <ThemedText style={nativeStyles.errorTextInline}>{removeError}</ThemedText>
        </View>
      )}
      <View style={nativeStyles.memberRowContent}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.two, flex: 1 }}>
          <ThemedText type="default" style={{ fontWeight: '500' }}>
            {member.user?.firstName || member.user?.username} {member.user?.lastName || ''} (@{member.user?.username})
          </ThemedText>
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            {Strings.teamList.roleLabel(getRoleLabel(member.role), member.isAdmin)}
          </ThemedText>
          {member.status === 'PENDING' && (
            <ThemedText type="small" style={{ opacity: 0.7, color: '#6366f1', fontWeight: 'bold' }}>
              {Strings.teamList.pendingMemberBadge}
            </ThemedText>
          )}
        </View>

        {isTeamAdmin && !isMe && (
          <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
            <TouchableOpacity
              style={[nativeStyles.editBtn, { backgroundColor: theme.backgroundSelected }]}
              onPress={startEdit}
            >
              <ThemedText style={{ fontSize: 11, fontWeight: 'bold' }}>עריכה ✏️</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[nativeStyles.editBtn, { backgroundColor: '#ffebee' }]}
              onPress={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <ActivityIndicator size="small" color="#c62828" />
              ) : (
                <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#c62828' }}>הסר 🗑️</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
