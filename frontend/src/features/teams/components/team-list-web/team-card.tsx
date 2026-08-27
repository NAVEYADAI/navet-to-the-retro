import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { TeamSprintsManager } from '@/features/sprints';
import { Box, Card, CardContent, Typography, Button, Chip, Alert, List, Grow } from '@mui/material';
import { TeamMemberRow } from './team-member-row';
import { AddMemberForm } from './add-member-form';
import { InviteLinksPanel } from './invite-links-panel';
import type { TeamListTheme } from '@/features/teams/types';

interface TeamCardProps {
  team: any;
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
  theme: TeamListTheme;
  animationDelay: number;
}

export function TeamCard({ team, token, userId, onAddMemberSuccess, onSelectSprint, theme, animationDelay }: TeamCardProps) {
  const [isAddMemberFormVisible, setIsAddMemberFormVisible] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const myMembership = team.members?.find((m: any) => m.userId === userId);
  const isTeamAdmin = myMembership?.isAdmin || false;

  const isPending = team.status === 'PENDING_APPROVAL';
  const isMyPendingTeam = isPending && team.creatorId === userId;

  const handleCancelPendingTeam = async () => {
    setCancelError(null);
    setCancelLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/decline`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onAddMemberSuccess();
    } catch (err: any) {
      setCancelError(err.response?.data?.message || err.message || Strings.dashboard.teamActionFailedError);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <Grow in={true} timeout={300 + animationDelay}>
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

          {isMyPendingTeam && (
            <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
              <Chip
                label={Strings.dashboard.pendingApprovalFromLabel(team.pendingApprover?.email || '')}
                size="small"
                sx={{ backgroundColor: '#ede9fe', color: '#6366f1', fontWeight: 'bold', fontFamily: 'Rubik, sans-serif' }}
              />
              <Button
                size="small"
                disabled={cancelLoading}
                onClick={handleCancelPendingTeam}
                sx={{ color: '#c62828', fontWeight: 'bold', fontSize: 12, fontFamily: 'Rubik, sans-serif', textTransform: 'none' }}
              >
                {Strings.dashboard.cancelPendingTeamButton}
              </Button>
            </Box>
          )}
          {isMyPendingTeam && cancelError && (
            <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
              {cancelError}
            </Alert>
          )}

          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
                {Strings.teamList.membersHeader(team.members?.length || 0)}
              </Typography>
              {isTeamAdmin && !isPending && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setIsAddMemberFormVisible(v => !v)}
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
              {team.members?.map((member: any) => (
                <TeamMemberRow
                  key={member.id}
                  member={member}
                  teamId={team.id}
                  token={token}
                  isTeamAdmin={isTeamAdmin}
                  isMe={member.userId === userId}
                  onChanged={onAddMemberSuccess}
                  theme={theme}
                />
              ))}
            </List>
          </Box>

          <AddMemberForm
            teamId={team.id}
            token={token}
            isVisible={isAddMemberFormVisible && !isPending}
            onInviteSent={() => {
              setIsAddMemberFormVisible(false);
              onAddMemberSuccess();
            }}
            theme={theme}
          />

          {isTeamAdmin && !isPending && (
            <InviteLinksPanel teamId={team.id} token={token} theme={theme} />
          )}

          {!isPending && (
            <TeamSprintsManager
              team={team}
              token={token}
              isAdmin={isTeamAdmin}
              theme={theme}
              onSelectSprint={onSelectSprint}
            />
          )}
        </CardContent>
      </Card>
    </Grow>
  );
}
