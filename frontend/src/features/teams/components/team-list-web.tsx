import React, { useState } from 'react';
import { useColorScheme } from 'react-native';
import { Strings } from '@/constants/strings';
import { TeamSprintsManager } from '@/features/sprints';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
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
} from '@mui/material';

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

export function TeamListWeb({ teams, token, userId, onAddMemberSuccess, onSelectSprint, theme }: TeamListProps) {
  const [usernames, setUsernames] = useState<Record<number, string>>({});
  const [loadings, setLoadings] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});
  const [showAddMember, setShowAddMember] = useState<Record<number, boolean>>({});

  const [editingMemberId, setEditingMemberId] = useState<Record<number, number | null>>({});
  const [editRole, setEditRole] = useState<string>('DEVELOPER');
  const [editIsAdmin, setEditIsAdmin] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

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
              <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
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
                <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
                      כתובת אימייל
                    </Typography>
                    <TextField
                      placeholder="הכנס כתובת אימייל"
                      value={currentUsername}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsernames(prev => ({ ...prev, [teamId]: e.target.value }))}
                      size="small"
                      autoCapitalize="none"
                      type="email"
                      sx={{
                        direction: 'rtl',
                        input: { color: theme.text, textAlign: 'right', py: 1.2 },
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: theme.background,
                          borderRadius: '12px',
                          '& fieldset': { borderColor: theme.backgroundSelected },
                          '&:hover fieldset': { borderColor: theme.text },
                          '&.Mui-focused fieldset': { borderColor: theme.text, borderWidth: '1.5px' },
                        },
                        '& .MuiInputLabel-root': { display: 'none' },
                        '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
                      }}
                    />
                  </Box>

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
