import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Collapse, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Button, Field } from '@/components/ui';
import { RoleSelectorChips } from '@/features/auth/components/role-selector-chips';

interface AddMemberFormProps {
  teamId: number;
  token: string;
  isVisible: boolean;
  onInviteSent: () => void;
}

export function AddMemberForm({ teamId, token, isVisible, onInviteSent }: AddMemberFormProps) {
  const t = useTheme();
  const [username, setUsername] = useState('');
  // Parity fix: the native AddMemberForm already sends `role` (team-list-native/add-member-form.tsx)
  // — this was missing here entirely, so the web flow always fell through to TeamsService's
  // 'DEVELOPER' default regardless of what the admin actually intended for the invitee.
  const [role, setRole] = useState('DEVELOPER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddMember = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('נא למלא כתובת אימייל.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const response = await axios.post(`${getBackendUrl()}/teams/${teamId}/members`, {
        username: trimmed,
        role
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setUsername('');
      setRole('DEVELOPER');
      // A response with an `email` field means the person isn't registered yet — an invite
      // email was sent instead of creating a pending membership (see TeamsService.addMember).
      if (response.data?.email) {
        setSuccessMessage(Strings.teamList.emailInviteSentText(response.data.email));
      } else {
        onInviteSent();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בהוספת חבר צוות.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Collapse in={isVisible} timeout="auto" unmountOnExit>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${t.space[3]}px`,
          padding: `${t.space[3]}px`,
          marginBlockStart: `${t.space[1]}px`,
          border: `1px solid ${t.color.border}`,
          borderRadius: `${t.radius.card}px`,
        }}
      >
        <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
          הזמנת חבר חדש לצוות
        </Typography>

        {error && (
          <Alert severity="error" sx={{ ...t.type.body }}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ ...t.type.body }}>
            {successMessage}
          </Alert>
        )}

        <Field
          label="כתובת אימייל"
          value={username}
          onChangeText={setUsername}
          type="email"
          placeholder="הכנס כתובת אימייל"
        />

        <RoleSelectorChips role={role} onSelectRole={setRole} />

        <Button variant="primary" icon="user-plus" onPress={handleAddMember} disabled={isLoading} loading={isLoading}>
          {Strings.teamList.addMemberButton}
        </Button>
      </Box>
    </Collapse>
  );
}
