import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, Switch, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { TeamSprintsManager } from '@/features/sprints';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';

interface TeamListProps {
  teams: any[];
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function TeamListNative({ teams, token, userId, onAddMemberSuccess, onSelectSprint, theme }: TeamListProps) {
  const [usernames, setUsernames] = useState<Record<number, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [loadings, setLoadings] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  const [editingMemberId, setEditingMemberId] = useState<Record<number, number | null>>({});
  const [editRole, setEditRole] = useState<string>('DEVELOPER');
  const [editIsAdmin, setEditIsAdmin] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleAddMember = async (teamId: number) => {
    const username = (usernames[teamId] || '').trim();
    const role = selectedRoles[teamId] || 'DEVELOPER';

    if (!username) {
      setErrors(prev => ({ ...prev, [teamId]: 'נא למלא שם משתמש.' }));
      return;
    }

    setErrors(prev => ({ ...prev, [teamId]: null }));
    setLoadings(prev => ({ ...prev, [teamId]: true }));

    try {
      await axios.post(`${getBackendUrl()}/teams/${teamId}/members`, {
        username,
        role
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setUsernames(prev => ({ ...prev, [teamId]: '' }));
      setSelectedRoles(prev => ({ ...prev, [teamId]: 'DEVELOPER' }));
      onAddMemberSuccess();
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [teamId]: err.response?.data?.message || err.message || 'שגיאה בהוספת חבר צוות.' }));
    } finally {
      setLoadings(prev => ({ ...prev, [teamId]: false }));
    }
  };

  const startEditMember = (teamId: number, member: any) => {
    setEditingMemberId(prev => ({ ...prev, [teamId]: member.id }));
    setEditRole(member.role);
    setEditIsAdmin(member.isAdmin);
    setEditError(null);
  };

  const handleSaveMemberEdit = async (teamId: number, memberId: number) => {
    setEditError(null);
    setEditLoading(true);

    try {
      await axios.patch(`${getBackendUrl()}/teams/${teamId}/members/${memberId}`, {
        role: editRole,
        isAdmin: editIsAdmin
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setEditingMemberId(prev => ({ ...prev, [teamId]: null }));
      onAddMemberSuccess();
    } catch (err: any) {
      setEditError(err.response?.data?.message || err.message || 'שמירת השינויים נכשלה.');
    } finally {
      setEditLoading(false);
    }
  };

  const roles = [
    { label: 'מפתח', value: 'DEVELOPER' },
    { label: 'QA', value: 'TESTER' },
    { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER' },
    { label: 'מוביל צוות', value: 'TEAM_LEADER' }
  ];

  const getRoleLabel = (roleVal: string) => {
    const found = roles.find(r => r.value === roleVal);
    return found ? found.label : roleVal;
  };

  return (
    <View style={nativeStyles.teamsList}>
      <ThemedText type="subtitle" style={nativeStyles.sectionHeader}>
        הצוותים שלי
      </ThemedText>
      {teams.map((team) => {
        const teamId = team.id;
        const currentUsername = usernames[teamId] || '';
        const currentRole = selectedRoles[teamId] || 'DEVELOPER';
        const isLoading = loadings[teamId] || false;
        const currentError = errors[teamId] || null;
        
        const myMembership = team.members?.find((m: any) => m.userId === userId);
        const isTeamAdmin = myMembership?.isAdmin || false;
        const activeEditingId = editingMemberId[teamId] || null;

        return (
          <View key={teamId} style={[nativeStyles.infoSection, { backgroundColor: theme.backgroundElement }]}>
            <View style={nativeStyles.teamHeaderRow}>
              <View style={{ flex: 1, marginLeft: Spacing.two }}>
                <ThemedText type="subtitle" style={{ fontWeight: 'bold', textAlign: 'right' }}>
                  {team.name}
                </ThemedText>
              </View>
              <View style={[nativeStyles.roleBadge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={[nativeStyles.roleText, { color: theme.text }]}>
                  {`${team.roleInTeam ? getRoleLabel(team.roleInTeam) : ''}${isTeamAdmin ? ' • מנהל' : ''}`}
                </ThemedText>
              </View>
            </View>

            {!!team.mainOffice && (
              <View style={nativeStyles.infoRow}>
                <ThemedText type="default" style={{ fontWeight: 'bold', textAlign: 'right' }}>
                  {Strings.teamList.officeLocationLabel}
                </ThemedText>
                <ThemedText type="default" style={{ textAlign: 'right' }}>{team.mainOffice}</ThemedText>
              </View>
            )}

            <View style={nativeStyles.membersContainer}>
              <ThemedText type="default" style={{ fontWeight: 'bold', marginBottom: Spacing.one, textAlign: 'right' }}>
                {Strings.teamList.membersHeader(team.members?.length || 0)}
              </ThemedText>
              {team.members?.map((member: any) => {
                const isEditing = activeEditingId === member.id;
                const isMe = member.userId === userId;

                return (
                  <View key={member.id} style={nativeStyles.memberListItem}>
                    {isEditing ? (
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
                            onPress={() => handleSaveMemberEdit(teamId, member.id)}
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
                            onPress={() => setEditingMemberId(prev => ({ ...prev, [teamId]: null }))}
                          >
                            <ThemedText style={{ fontSize: 12 }}>{Strings.teamList.cancelButton}</ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={nativeStyles.memberRowContent}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.two, flex: 1 }}>
                          <ThemedText type="default" style={{ fontWeight: '500' }}>
                            {member.user?.firstName || member.user?.username} {member.user?.lastName || ''} (@{member.user?.username})
                          </ThemedText>
                          <ThemedText type="small" style={{ opacity: 0.7 }}>
                            {Strings.teamList.roleLabel(getRoleLabel(member.role), member.isAdmin)}
                          </ThemedText>
                        </View>

                        {isTeamAdmin && !isMe && (
                          <TouchableOpacity
                            style={[nativeStyles.editBtn, { backgroundColor: theme.backgroundSelected }]}
                            onPress={() => startEditMember(teamId, member)}
                          >
                            <ThemedText style={{ fontSize: 11, fontWeight: 'bold' }}>עריכה ✏️</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {isTeamAdmin && (
              <View style={nativeStyles.addMemberSection}>
                <ThemedText type="default" style={{ fontWeight: 'bold', textAlign: 'right' }}>
                  הוספת חבר צוות חדש
                </ThemedText>
                
                {!!currentError && (
                  <View style={nativeStyles.errorBannerInline}>
                    <ThemedText style={nativeStyles.errorTextInline}>{currentError}</ThemedText>
                  </View>
                )}

                <TextInput
                  style={[
                    nativeStyles.input,
                    {
                      color: theme.text,
                      borderColor: theme.backgroundSelected,
                      backgroundColor: theme.background,
                    },
                  ]}
                  placeholder={Strings.teamList.addMemberPlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  value={currentUsername}
                  onChangeText={(val) => setUsernames(prev => ({ ...prev, [teamId]: val }))}
                  autoCapitalize="none"
                />

                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                  {roles.map((r) => {
                    const selected = currentRole === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={[
                          nativeStyles.roleOptionBtn,
                          { backgroundColor: selected ? theme.backgroundSelected : theme.background }
                        ]}
                        onPress={() => setSelectedRoles(prev => ({ ...prev, [teamId]: r.value }))}
                      >
                        <ThemedText style={{ fontSize: 11, fontWeight: selected ? 'bold' : 'normal' }}>
                          {r.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[nativeStyles.button, { backgroundColor: theme.text }]}
                  onPress={() => handleAddMember(teamId)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.background} />
                  ) : (
                    <ThemedText style={[nativeStyles.buttonText, { color: theme.background }]}>
                      {Strings.teamList.addMemberButton}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TeamSprintsManager
              team={team}
              token={token}
              isAdmin={isTeamAdmin}
              theme={theme}
              onSelectSprint={onSelectSprint}
            />
          </View>
        );
      })}
    </View>
  );
}

const nativeStyles = StyleSheet.create({
  teamsList: { gap: Spacing.four },
  sectionHeader: { fontSize: 20, fontWeight: 'bold', marginVertical: Spacing.one },
  infoSection: { padding: Spacing.three, borderRadius: 10, gap: Spacing.three },
  teamHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  roleBadge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: 12 },
  roleText: { fontSize: 12, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row-reverse', gap: Spacing.one },
  membersContainer: { gap: Spacing.one, marginTop: Spacing.one },
  memberListItem: { paddingVertical: Spacing.one },
  memberRowContent: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  editMemberPane: { padding: Spacing.two, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.02)', gap: Spacing.one },
  roleOptionBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  actionSaveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  actionCancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  addMemberSection: { gap: Spacing.two, marginTop: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  input: { height: 42, borderWidth: 1, borderRadius: 6, paddingHorizontal: Spacing.two, fontSize: 14, textAlign: 'right' },
  button: { height: 42, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.one },
  buttonText: { fontSize: 14, fontWeight: 'bold' },
  errorBannerInline: { backgroundColor: '#ffebee', padding: 6, borderRadius: 4, borderWidth: 1, borderColor: '#ffcdd2' },
  errorTextInline: { color: '#c62828', fontSize: 12, textAlign: 'right' },
});
