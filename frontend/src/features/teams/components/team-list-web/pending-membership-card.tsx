import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Button, Card, TeamLogo } from '@/components/ui';

interface PendingMembershipCardProps {
  team: any;
  token: string;
  onResolved: () => void;
}

// Shown instead of the full team card when the current user has a PENDING invite to join —
// they aren't an active member yet, so they only get an accept/decline choice, not the full
// member list / sprints / admin tools.
export function PendingMembershipCard({ team, token, onResolved }: PendingMembershipCardProps) {
  const t = useTheme();
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
    <Card padding={5}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[3]}px` }}>
        {/* פיצ'ר 19: מוזמן במצב PENDING כבר רואה את לוגו הצוות (החלטה #9). */}
        {!!team.logoUpdatedAt && <TeamLogo teamId={team.id} name={team.name} logoUpdatedAt={team.logoUpdatedAt} size="lg" />}
        <Typography component="h3" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>
          {team.name}
        </Typography>
      </Box>
      <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
        {Strings.dashboard.memberInviteText}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ ...t.type.body }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', gap: `${t.space[3]}px` }}>
        <Button variant="primary" icon="check" disabled={loading} loading={loading} onPress={() => respond('accept')}>
          {Strings.dashboard.approveTeamButton}
        </Button>
        <Button variant="secondary" icon="x" disabled={loading} onPress={() => respond('decline')}>
          {Strings.dashboard.declineTeamButton}
        </Button>
      </Box>
    </Card>
  );
}
