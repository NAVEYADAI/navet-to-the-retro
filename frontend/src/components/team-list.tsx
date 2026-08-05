import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { TeamSprintsManager } from './team-sprints-manager';
import { Strings } from '@/constants/strings';
import axios from 'axios';

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

export function TeamList({ teams, token, userId, onAddMemberSuccess, onSelectSprint, theme }: TeamListProps) {
  // Map-based states to handle inputs independently for each team
  const [usernames, setUsernames] = useState<Record<number, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [loadings, setLoadings] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  // Editing state for members: teamId -> memberId -> boolean
  const [editingMemberId, setEditingMemberId] = useState<Record<number, number | null>>({});
  const [editRole, setEditRole] = useState<string>('DEVELOPER');
  const [editIsAdmin, setEditIsAdmin] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const getBackendUrl = () => {
    return typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

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
    { label: 'בודק', value: 'TESTER' },
    { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER' },
    { label: 'מוביל צוות', value: 'TEAM_LEADER' }
  ];

  const getRoleLabel = (roleVal: string) => {
    const found = roles.find(r => r.value === roleVal);
    return found ? found.label : roleVal;
  };

  return (
    <View style={styles.teamsList}>
      <ThemedText type="subtitle" style={styles.sectionHeader}>
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
          <View
            key={teamId}
            style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}
          >
            <View style={styles.teamHeaderRow}>
              <View style={{ flex: 1, marginRight: Spacing.two }}>
                <ThemedText type="subtitle" style={{ fontWeight: 'bold' }}>
                  {team.name}
                </ThemedText>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={[styles.roleText, { color: theme.text }]}>
                  {`${team.roleInTeam ? getRoleLabel(team.roleInTeam) : ''}${isTeamAdmin ? ' • מנהל' : ''}`}
                </ThemedText>
              </View>
            </View>

            {!!team.mainOffice && (
              <View style={styles.infoRow}>
                <ThemedText type="default" style={{ fontWeight: 'bold' }}>
                  {Strings.teamList.officeLocationLabel}
                </ThemedText>
                <ThemedText type="default">{team.mainOffice}</ThemedText>
              </View>
            )}

            <View style={styles.membersContainer}>
              <ThemedText type="default" style={{ fontWeight: 'bold', marginBottom: Spacing.one }}>
                {Strings.teamList.membersHeader(team.members?.length || 0)}
              </ThemedText>
              {team.members?.map((member: any) => {
                const isEditing = activeEditingId === member.id;
                const isMe = member.userId === userId;

                return (
                  <View key={member.id} style={styles.memberListItem}>
                    {isEditing ? (
                      /* Editing Pane */
                      <View style={styles.editMemberPane}>
                        <ThemedText style={{ fontSize: 13, fontWeight: 'bold' }}>
                          {Strings.teamList.editMemberHeader(member.user?.username)}
                        </ThemedText>
                        
                        {!!editError && (
                          <View style={styles.errorBanner}>
                            <ThemedText style={styles.errorText}>{editError}</ThemedText>
                          </View>
                        )}

                        <View style={styles.rolesRow}>
                          {roles.map((r) => {
                            const isSel = editRole === r.value;
                            return (
                              <TouchableOpacity
                                key={r.value}
                                style={[
                                  styles.roleSelectBadge,
                                  {
                                    backgroundColor: isSel ? theme.text : theme.background,
                                    borderColor: theme.backgroundSelected,
                                  },
                                ]}
                                onPress={() => setEditRole(r.value)}
                              >
                                <ThemedText
                                  style={[
                                    styles.roleSelectText,
                                    { color: isSel ? theme.background : theme.text },
                                  ]}
                                >
                                  {r.label}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <View style={styles.adminToggleRow}>
                          <ThemedText style={{ fontSize: 13 }}>{Strings.teamList.teamAdminPrivileges}</ThemedText>
                          <Switch
                            value={editIsAdmin}
                            onValueChange={setEditIsAdmin}
                            trackColor={{ false: theme.backgroundSelected, true: theme.text }}
                            thumbColor={editIsAdmin ? theme.background : theme.backgroundSelected}
                          />
                        </View>

                        <View style={styles.editActionsRow}>
                          <TouchableOpacity
                            style={[styles.smallButton, { backgroundColor: theme.backgroundSelected }]}
                            onPress={() => setEditingMemberId(prev => ({ ...prev, [teamId]: null }))}
                          >
                            <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>
                              {Strings.teamList.cancelButton}
                            </ThemedText>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.smallButton, { backgroundColor: theme.text }]}
                            onPress={() => handleSaveMemberEdit(teamId, member.id)}
                            disabled={editLoading}
                          >
                            {editLoading ? (
                              <ActivityIndicator color={theme.background} size="small" />
                            ) : (
                              <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: theme.background }}>
                                {Strings.teamList.saveButton}
                              </ThemedText>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      /* Display member info */
                      <View style={styles.memberItem}>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="default">
                            {`• ${member.user?.firstName || ''} ${member.user?.lastName || ''} (@${member.user?.username || ''})`}
                          </ThemedText>
                          <ThemedText type="code" style={{ fontSize: 11, opacity: 0.8 }}>
                            {`[${member.role ? getRoleLabel(member.role) : ''}]${member.isAdmin ? ' (מנהל)' : ''}`}
                          </ThemedText>
                        </View>

                        {/* Edit Role Option: Admin-only and can't edit themselves */}
                        {isTeamAdmin && !isMe && (
                          <TouchableOpacity
                            style={[styles.editMemberButton, { backgroundColor: theme.backgroundSelected }]}
                            onPress={() => startEditMember(teamId, member)}
                          >
                            <ThemedText style={{ fontSize: 11, color: theme.text, fontWeight: 'bold' }}>
                              ערוך
                            </ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Team Leader actions: add members form */}
            {isTeamAdmin && (
              <View style={styles.addMemberContainer}>
                <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14, marginTop: Spacing.one }}>
                  הוספת חבר לצוות
                </ThemedText>

                {!!currentError && (
                  <View style={styles.errorBanner}>
                    <ThemedText style={styles.errorText}>{currentError}</ThemedText>
                  </View>
                )}

                <TextInput
                  style={[
                    styles.input,
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

                <View style={styles.rolesRow}>
                  {roles.map((r) => {
                    const isSelected = currentRole === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={[
                          styles.roleSelectBadge,
                          {
                            backgroundColor: isSelected ? theme.text : theme.background,
                            borderColor: theme.backgroundSelected,
                          },
                        ]}
                        onPress={() => setSelectedRoles(prev => ({ ...prev, [teamId]: r.value }))}
                      >
                        <ThemedText
                          style={[
                            styles.roleSelectText,
                            { color: isSelected ? theme.background : theme.text },
                          ]}
                        >
                          {r.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: theme.text }]}
                  onPress={() => handleAddMember(teamId)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.background} size="small" />
                  ) : (
                    <ThemedText style={[styles.addButtonText, { color: theme.background }]}>
                      {Strings.teamList.addMemberButton}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Sprints Section */}
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

const styles = StyleSheet.create({
  teamsList: {
    gap: Spacing.three,
  },
  infoSection: {
    padding: Spacing.three,
    borderRadius: 10,
    gap: Spacing.two,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  membersContainer: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  memberListItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    paddingVertical: 6,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editMemberButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editMemberPane: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  adminToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  addMemberContainer: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: Spacing.two,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  roleSelectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleSelectText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addButton: {
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.two,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 13,
    textAlign: 'center',
  },
});
