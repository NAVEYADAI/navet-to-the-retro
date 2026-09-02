import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Card, Button, Field, Icon } from '@/components/ui';
import { Strings } from '@/constants/strings';

interface AdminTeamsCardProps {
  adminTeams: any[];
  loadingTeams: boolean;
  onRefresh: () => void;
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
}

export function AdminTeamsCard({
  adminTeams,
  loadingTeams,
  onRefresh,
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
}: AdminTeamsCardProps) {
  const t = useTheme();

  return (
    <Card padding={5}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
          ניהול ועריכת צוותים בניהולך
        </Typography>
        <Button variant="ghost" size="sm" icon="refresh" onPress={onRefresh} disabled={loadingTeams}>
          {Strings.common.refreshButton}
        </Button>
      </Box>

      {teamEditMessage && (
        <Alert severity={teamEditMessage.isError ? 'error' : 'success'} sx={{ ...t.type.body }}>
          {teamEditMessage.text}
        </Alert>
      )}

      {loadingTeams ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', paddingBlock: `${t.space[4]}px` }}>
          <CircularProgress size={24} sx={{ color: t.color.text }} />
        </Box>
      ) : adminTeams.length === 0 ? (
        <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>
          אינך מנהל של אף צוות במערכת כרגע.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[4]}px` }}>
          {adminTeams.map((team) => {
            const isEditing = editTeamId === team.id;
            return (
              <Box
                key={team.id}
                sx={{
                  padding: `${t.space[3]}px`,
                  borderRadius: `${t.radius.field}px`,
                  border: `1px solid ${t.color.border}`,
                  backgroundColor: t.color.surfaceSubtle,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${t.space[3]}px`,
                }}
              >
                {isEditing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[4]}px` }}>
                    <Field
                      label="שם הצוות"
                      value={editTeamName}
                      onChangeText={setEditTeamName}
                      placeholder="הכנס שם צוות"
                    />
                    <Field
                      label="משרד ראשי / מיקום"
                      value={editTeamOffice}
                      onChangeText={setEditTeamOffice}
                      placeholder="הכנס מיקום/משרד ראשי"
                    />

                    <Box sx={{ display: 'flex', gap: `${t.space[3]}px` }}>
                      <Button
                        variant="primary"
                        onPress={() => onSaveTeamEdit(team.id)}
                        disabled={teamEditLoading}
                        loading={teamEditLoading}
                      >
                        שמור שינויים
                      </Button>
                      <Button variant="secondary" onPress={() => setEditTeamId(null)}>
                        ביטול
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[3]}px` }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
                      <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
                        {team.name}
                      </Typography>
                      {!!team.mainOffice && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
                          <Icon name="map-pin" size="sm" tone="muted" />
                          <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
                            {team.mainOffice}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon="edit"
                      onPress={() => {
                        setEditTeamId(team.id);
                        setEditTeamName(team.name);
                        setEditTeamOffice(team.mainOffice || '');
                        setTeamEditMessage(null);
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
    </Card>
  );
}
