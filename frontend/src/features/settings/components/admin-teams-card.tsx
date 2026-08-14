import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Grow,
} from '@mui/material';
import { getSettingsCardSx, getSettingsInputSx } from '../styles/settings.styles';

interface AdminTeamsCardProps {
  adminTeams: any[];
  loadingTeams: boolean;
  editTeamId: number | null;
  setEditTeamId: (id: number | null) => void;
  editTeamName: string;
  setEditTeamName: (val: string) => void;
  editTeamOffice: string;
  setEditTeamOffice: (val: string) => void;
  teamEditLoading: boolean;
  teamEditMessage: { text: string; isError: boolean } | null;
  setTeamEditMessage: (msg: { text: string; isError: boolean } | null) => void;
  onSaveTeamEdit: (teamId: number) => void;
  isDark: boolean;
  themeColors: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function AdminTeamsCard({
  adminTeams,
  loadingTeams,
  editTeamId,
  setEditTeamId,
  editTeamName,
  setEditTeamName,
  editTeamOffice,
  setEditTeamOffice,
  teamEditLoading,
  teamEditMessage,
  setTeamEditMessage,
  onSaveTeamEdit,
  isDark,
  themeColors,
}: AdminTeamsCardProps) {
  const cardSx = getSettingsCardSx(isDark);
  const inputSx = getSettingsInputSx(themeColors);

  return (
    <Grow in={true} timeout={600}>
      <Card sx={cardSx}>
        <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
            🛠️ ניהול ועריכת צוותים בניהולך
          </Typography>

          {teamEditMessage && (
            <Alert
              severity={teamEditMessage.isError ? 'error' : 'success'}
              sx={{ flexDirection: 'row-reverse', textAlign: 'right', mb: 3 }}
            >
              {teamEditMessage.text}
            </Alert>
          )}

          {loadingTeams ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress color="inherit" sx={{ color: themeColors.text }} />
            </Box>
          ) : adminTeams.length === 0 ? (
            <Typography sx={{ color: themeColors.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
              אינך מנהל של אף צוות במערכת כרגע.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {adminTeams.map((team) => {
                const isEditing = editTeamId === team.id;
                return (
                  <Box
                    key={team.id}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: '1px solid rgba(0,0,0,0.06)',
                      backgroundColor: themeColors.background,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2
                    }}
                  >
                    {isEditing ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: themeColors.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
                            שם הצוות
                          </Typography>
                          <TextField
                            placeholder="הכנס שם צוות"
                            value={editTeamName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTeamName(e.target.value)}
                            size="small"
                            sx={inputSx}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: themeColors.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
                            משרד ראשי / מיקום
                          </Typography>
                          <TextField
                            placeholder="הכנס מיקום/משרד ראשי"
                            value={editTeamOffice}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTeamOffice(e.target.value)}
                            size="small"
                            sx={inputSx}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-start' }}>
                          <Button
                            variant="contained"
                            onClick={() => onSaveTeamEdit(team.id)}
                            disabled={teamEditLoading}
                            sx={{
                              backgroundColor: themeColors.text,
                              color: themeColors.background,
                              fontWeight: 'bold',
                              fontFamily: 'Rubik, sans-serif'
                            }}
                          >
                            שמור שינויים
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => setEditTeamId(null)}
                            sx={{
                              borderColor: themeColors.backgroundSelected,
                              color: themeColors.text,
                              fontWeight: 'bold',
                              fontFamily: 'Rubik, sans-serif'
                            }}
                          >
                            ביטול
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                          <Typography sx={{ fontWeight: 'bold', color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                            {team.name}
                          </Typography>
                          {!!team.mainOffice && (
                            <Typography variant="body2" sx={{ color: themeColors.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                              🏢 משרד: {team.mainOffice}
                            </Typography>
                          )}
                        </Box>

                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setEditTeamId(team.id);
                            setEditTeamName(team.name);
                            setEditTeamOffice(team.mainOffice || '');
                            setTeamEditMessage(null);
                          }}
                          sx={{
                            borderColor: themeColors.backgroundSelected,
                            color: '#007aff',
                            fontWeight: 'bold',
                            fontFamily: 'Rubik, sans-serif'
                          }}
                        >
                          ערוך פרטים
                        </Button>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </Grow>
  );
}
