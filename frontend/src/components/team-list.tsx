import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Switch, Platform, useColorScheme } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { TeamSprintsManager } from './team-sprints-manager';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  TextField,
  Collapse,
  Switch as MuiSwitch,
  CircularProgress,
  Alert,
  List,
  ListItem,
  FormControlLabel,
  Grow,
  Fade,
} from '@mui/material';

// Platform safe shadow utility to avoid React Native Web deprecated shadow warnings
const getShadow = (opacity: number, radius: number, offsetHeight: number) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${offsetHeight}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: offsetHeight },
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
};

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

export function TeamList(props: TeamListProps) {
  if (Platform.OS === 'web') {
    return <TeamListWeb {...props} />;
  }
  return <TeamListNative {...props} />;
}

/* 1. WEB VERSION (Material UI + Smooth entry and collapsible transitions) */
function TeamListWeb({ teams, token, userId, onAddMemberSuccess, onSelectSprint, theme }: TeamListProps) {
  const colorScheme = useColorScheme();

  const [usernames, setUsernames] = useState<Record<number, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [loadings, setLoadings] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});
  const [showAddMember, setShowAddMember] = useState<Record<number, boolean>>({});

  const [editingMemberId, setEditingMemberId] = useState<Record<number, number | null>>({});
  const [editRole, setEditRole] = useState<string>('DEVELOPER');
  const [editIsAdmin, setEditIsAdmin] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const handleAddMember = async (teamId: number) => {
    const username = (usernames[teamId] || '').trim();

    if (!username) {
      setErrors(prev => ({ ...prev, [teamId]: 'נא למלא כתובת אימייל.' }));
      return;
    }

    setErrors(prev => ({ ...prev, [teamId]: null }));
    setLoadings(prev => ({ ...prev, [teamId]: true }));

    try {
      await axios.post(`${getBackendUrl()}/teams/${teamId}/members`, {
        username
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setUsernames(prev => ({ ...prev, [teamId]: '' }));
      setShowAddMember(prev => ({ ...prev, [teamId]: false }));
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
    { label: 'ראש צוות', value: 'TEAM_LEADER' },
    { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER' },
    { label: 'מפתח', value: 'DEVELOPER' },
    { label: 'QA', value: 'TESTER' }
  ];

  const getRoleStyle = (roleVal: string) => {
    switch (roleVal) {
      case 'TEAM_LEADER':
        return { bg: '#f3e5f5', text: '#7b1fa2' };
      case 'PRODUCT_MANAGER':
        return { bg: '#e3f2fd', text: '#1565c0' };
      case 'DEVELOPER':
        return { bg: '#e8f5e9', text: '#2e7d32' };
      case 'TESTER':
      case 'QA':
        return { bg: '#fff3e0', text: '#e65100' };
      default:
        return { bg: theme.backgroundSelected, text: theme.text };
    }
  };

  const getRoleLabel = (roleVal: string) => {
    const found = roles.find(r => r.value === roleVal);
    return found ? found.label : roleVal;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.text, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
        הצוותים שלי
      </Typography>

      {teams.map((team) => {
        const teamId = team.id;
        const currentUsername = usernames[teamId] || '';
        const currentRole = selectedRoles[teamId] || 'DEVELOPER';
        const isLoading = loadings[teamId] || false;
        const currentError = errors[teamId] || null;
        
        const myMembership = team.members?.find((m: any) => m.userId === userId);
        const isTeamAdmin = myMembership?.isAdmin || false;
        const activeEditingId = editingMemberId[teamId] || null;
        const isAddMemberFormVisible = showAddMember[teamId] || false;

        return (
          <Grow in={true} key={teamId} timeout={300 + teams.indexOf(team) * 120}>
          <Card
            sx={{
              backgroundColor: theme.backgroundElement,
              borderColor: theme.backgroundSelected,
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 4,
              boxShadow: '0px 2px 8px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
              '&:hover': {
                boxShadow: '0px 8px 24px rgba(0,0,0,0.08)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif', textAlign: 'right' }}>
                  {team.name}
                </Typography>
                {!!team.mainOffice && (
                  <Typography variant="body2" sx={{ color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                    🏢 {team.mainOffice}
                  </Typography>
                )}
              </Box>

              <Box>
                <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
                    {Strings.teamList.membersHeader(team.members?.length || 0)}
                  </Typography>
                  {isTeamAdmin && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setShowAddMember(prev => ({ ...prev, [teamId]: !isAddMemberFormVisible }))}
                      sx={{
                        borderColor: theme.backgroundSelected,
                        color: '#007aff',
                        fontSize: 12,
                        fontWeight: 'bold',
                        fontFamily: 'Rubik, sans-serif',
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: theme.text,
                          backgroundColor: 'rgba(0,0,0,0.01)',
                        }
                      }}
                    >
                      {isAddMemberFormVisible ? '✕ סגור' : '+ הוסף חבר צוות'}
                    </Button>
                  )}
                </Box>

                <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {team.members?.map((member: any) => {
                    const isEditing = activeEditingId === member.id;
                    const isMe = member.userId === userId;
                    const roleStyle = getRoleStyle(member.role);
                    const fullName = member.user?.firstName || member.user?.lastName 
                      ? `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim()
                      : `@${member.user?.username || ''}`;

                    return (
                      <ListItem
                        key={member.id}
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
                                    onChange={(e) => setEditIsAdmin(e.target.checked)}
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
                                onClick={() => handleSaveMemberEdit(teamId, member.id)}
                                disabled={editLoading}
                                sx={{ backgroundColor: theme.text, color: theme.background, fontWeight: 'bold', fontFamily: 'Rubik, sans-serif' }}
                              >
                                {editLoading ? <CircularProgress size={16} color="inherit" /> : 'שמור'}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setEditingMemberId(prev => ({ ...prev, [teamId]: null }))}
                                sx={{ borderColor: theme.backgroundSelected, color: theme.text, fontWeight: 'bold', fontFamily: 'Rubik, sans-serif' }}
                              >
                                ביטול
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <>
                            <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 1 }}>
                              {member.isAdmin && (
                                <Typography sx={{ fontSize: 13 }} title="מנהל צוות">
                                  👑
                                </Typography>
                              )}
                              <Typography variant="body2" sx={{ color: theme.text, fontWeight: '600', fontFamily: 'Rubik, sans-serif' }}>
                                {fullName}
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 1.5 }}>
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
                                  onClick={() => startEditMember(teamId, member)}
                                  sx={{
                                    color: '#007aff',
                                    fontWeight: 'bold',
                                    fontSize: 11,
                                    fontFamily: 'Rubik, sans-serif',
                                    minWidth: 0,
                                    p: 0,
                                  }}
                                >
                                  ערוך
                                </Button>
                              )}
                            </Box>
                          </>
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              </Box>

              <Collapse in={isAddMemberFormVisible} timeout="auto" unmountOnExit>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, mt: 1, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', color: theme.text, fontSize: 13, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
                    הוספת חבר חדש לצוות
                  </Typography>

                  {currentError && (
                    <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
                      {currentError}
                    </Alert>
                  )}

                  <TextField
                    label="כתובת אימייל"
                    value={currentUsername}
                    onChange={(e) => setUsernames(prev => ({ ...prev, [teamId]: e.target.value }))}
                    size="small"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    sx={{
                      input: { color: theme.text, textAlign: 'right' },
                      label: { color: theme.textSecondary, right: 28, left: 'auto' },
                      fieldset: { borderColor: theme.backgroundSelected },
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: theme.background,
                        '&:hover fieldset': { borderColor: theme.text },
                        '&.Mui-focused fieldset': { borderColor: theme.text },
                      }
                    }}
                  />

                  <Button
                    variant="contained"
                    onClick={() => handleAddMember(teamId)}
                    disabled={isLoading}
                    sx={{
                      backgroundColor: theme.text,
                      color: theme.background,
                      fontWeight: 'bold',
                      fontFamily: 'Rubik, sans-serif',
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: theme.textSecondary,
                      }
                    }}
                  >
                    {isLoading ? <CircularProgress size={20} color="inherit" /> : 'הוסף לצוות'}
                  </Button>
                </Box>
              </Collapse>

              <TeamSprintsManager
                team={team}
                token={token}
                isAdmin={isTeamAdmin}
                theme={theme}
                onSelectSprint={onSelectSprint}
              />
            </CardContent>
          </Card>
          </Grow>
        );
      })}
    </Box>
  );
}

/* 2. NATIVE VERSION (React Native - fully RTL & Jest compatible) */
function TeamListNative({ teams, token, userId, onAddMemberSuccess, onSelectSprint, theme }: TeamListProps) {
  const [usernames, setUsernames] = useState<Record<number, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [loadings, setLoadings] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  const [editingMemberId, setEditingMemberId] = useState<Record<number, number | null>>({});
  const [editRole, setEditRole] = useState<string>('DEVELOPER');
  const [editIsAdmin, setEditIsAdmin] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
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
                          <View style={nativeStyles.errorBanner}>
                            <ThemedText style={nativeStyles.errorText}>{editError}</ThemedText>
                          </View>
                        )}

                        <View style={nativeStyles.rolesRow}>
                          {roles.map((r) => {
                            const isSel = editRole === r.value;
                            return (
                              <TouchableOpacity
                                key={r.value}
                                style={[
                                  nativeStyles.roleSelectBadge,
                                  {
                                    backgroundColor: isSel ? theme.text : theme.background,
                                    borderColor: theme.backgroundSelected,
                                  },
                                ]}
                                onPress={() => setEditRole(r.value)}
                              >
                                <ThemedText
                                  style={[
                                    nativeStyles.roleSelectText,
                                    { color: isSel ? theme.background : theme.text },
                                  ]}
                                >
                                  {r.label}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <View style={nativeStyles.adminToggleRow}>
                          <Switch
                            value={editIsAdmin}
                            onValueChange={setEditIsAdmin}
                            disabled={isMe}
                            trackColor={{ false: theme.backgroundSelected, true: theme.text }}
                            thumbColor={editIsAdmin ? theme.background : theme.backgroundSelected}
                          />
                          <ThemedText style={{ fontSize: 13 }}>{Strings.teamList.teamAdminPrivileges}</ThemedText>
                        </View>

                        <View style={nativeStyles.editActionsRow}>
                          <TouchableOpacity
                            style={[nativeStyles.smallButton, { backgroundColor: theme.backgroundSelected }]}
                            onPress={() => setEditingMemberId(prev => ({ ...prev, [teamId]: null }))}
                          >
                            <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>
                              {Strings.teamList.cancelButton}
                            </ThemedText>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[nativeStyles.smallButton, { backgroundColor: theme.text }]}
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
                      <View style={nativeStyles.memberItem}>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <ThemedText type="default" style={{ textAlign: 'right' }}>
                            {`• ${member.user?.firstName || ''} ${member.user?.lastName || ''} (@${member.user?.username || ''})`}
                          </ThemedText>
                          <ThemedText type="code" style={{ fontSize: 11, opacity: 0.8, textAlign: 'right' }}>
                            {`[${member.role ? getRoleLabel(member.role) : ''}]${member.isAdmin ? ' (מנהל)' : ''}`}
                          </ThemedText>
                        </View>

                        {isTeamAdmin && (
                          <TouchableOpacity
                            style={[nativeStyles.editMemberButton, { backgroundColor: theme.backgroundSelected, marginRight: Spacing.two }]}
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

            {isTeamAdmin && (
              <View style={nativeStyles.addMemberContainer}>
                <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14, marginTop: Spacing.one, textAlign: 'right' }}>
                  הוספת חבר לצוות
                </ThemedText>

                {!!currentError && (
                  <View style={nativeStyles.errorBanner}>
                    <ThemedText style={nativeStyles.errorText}>{currentError}</ThemedText>
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
                  placeholder="כתובת אימייל"
                  placeholderTextColor={theme.textSecondary}
                  value={currentUsername}
                  onChangeText={(val) => setUsernames(prev => ({ ...prev, [teamId]: val }))}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TouchableOpacity
                  style={[nativeStyles.addButton, { backgroundColor: theme.text }]}
                  onPress={() => handleAddMember(teamId)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.background} size="small" />
                  ) : (
                    <ThemedText style={[nativeStyles.addButtonText, { color: theme.background }]}>
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
    textAlign: 'right',
  },
  teamHeaderRow: {
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
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
    textAlign: 'right',
  },
  rolesRow: {
    flexDirection: 'row-reverse',
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
