import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Card, CardContent, Typography, Button, CircularProgress, Alert, Grow } from '@mui/material';
import type { TeamListTheme } from '@/features/teams/types';

interface PendingMembershipCardProps {
  team: any;
  token: string;
  onResolved: () => void;
  theme: TeamListTheme;
  animationDelay: number;
}

// Shown instead of the full team card when the current user has a PENDING invite to join —
// they aren't an active member yet, so they only get an accept/decline choice, not the full
// member list / sprints / admin tools.
export function PendingMembershipCard({ team, token, onResolved, theme, animationDelay }: PendingMembershipCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = async (action: 'accept' | 'decline') => {
    setError(null);
    setLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/members/${team.myMembershipId}/${action}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onResolved();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.dashboard.teamActionFailedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grow in={true} timeout={300 + animationDelay}>
      <Card sx={{ backgroundColor: theme.backgroundElement, border: '2px solid #6366f1', borderRadius: 4 }}>
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
            {team.name}
          </Typography>
          <Typography sx={{ color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
            {Strings.dashboard.memberInviteText}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'row-reverse', gap: 1.5 }}>
            <Button
              variant="contained"
              disabled={loading}
              onClick={() => respond('accept')}
              sx={{ backgroundColor: '#6366f1', fontWeight: 'bold', fontFamily: 'Rubik, sans-serif', textTransform: 'none' }}
            >
              {loading ? <CircularProgress size={18} color="inherit" /> : Strings.dashboard.approveTeamButton}
            </Button>
            <Button
              variant="outlined"
              disabled={loading}
              onClick={() => respond('decline')}
              sx={{ borderColor: theme.backgroundSelected, color: theme.text, fontWeight: 'bold', fontFamily: 'Rubik, sans-serif', textTransform: 'none' }}
            >
              {Strings.dashboard.declineTeamButton}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );
}
