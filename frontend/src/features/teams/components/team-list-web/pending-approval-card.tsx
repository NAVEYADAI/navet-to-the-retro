import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Button, Card, Badge } from '@/components/ui';

interface PendingApprovalCardProps {
  team: any;
  token: string;
  onResolved: () => void;
}

// Shown to the designated approver while the team they were asked to approve is still
// PENDING_APPROVAL — approve/decline the team's creation itself.
export function PendingApprovalCard({ team, token, onResolved }: PendingApprovalCardProps) {
  const t = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = async (action: 'approve' | 'decline') => {
    setError(null);
    setLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/${action}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      onResolved();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.dashboard.teamActionFailedError);
    } finally {
      setLoading(false);
    }
  };

  const creatorMember = team.members?.find((m: any) => m.userId === team.creatorId);
  const creatorName = creatorMember?.user?.firstName || creatorMember?.user?.lastName
    ? `${creatorMember?.user?.firstName || ''} ${creatorMember?.user?.lastName || ''}`.trim()
    : `@${creatorMember?.user?.username || ''}`;

  return (
    <Card padding={5}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
        <Typography component="h3" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0, minWidth: 0 }}>
          {team.name}
        </Typography>
        <Badge tone="accent">ממתין לאישורך</Badge>
      </Box>
      <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
        {Strings.dashboard.approvalInviteText(creatorName)}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ ...t.type.body }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', gap: `${t.space[3]}px` }}>
        <Button variant="primary" icon="check" disabled={loading} loading={loading} onPress={() => respond('approve')}>
          {Strings.dashboard.approveTeamButton}
        </Button>
        <Button variant="secondary" icon="x" disabled={loading} onPress={() => respond('decline')}>
          {Strings.dashboard.declineTeamButton}
        </Button>
      </Box>
    </Card>
  );
}
