import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Button, Field } from '@/components/ui';
import { RoleSelectorChips } from '@/features/auth/components/role-selector-chips';
import { trackEvent } from '@/lib/analytics';

interface AddPhantomMemberFormProps {
  teamId: number;
  token: string;
  onCreated: () => void;
}

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2) — body of the phantom tab
// in AddMemberModal (add-member-modal.tsx), same shape as AddMemberForm, but for a real person who refuses to register:
// first/last name instead of username/email, no invite email sent, `POST
// /teams/:teamId/phantom-members` creates the phantom TeamMember directly.
export function AddPhantomMemberForm({ teamId, token, onCreated }: AddPhantomMemberFormProps) {
  const t = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) {
      setError(Strings.teamList.phantomFirstNameRequiredError);
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${teamId}/phantom-members`, {
        firstName: trimmedFirstName,
        lastName: lastName.trim() || undefined,
        role
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setFirstName('');
      setLastName('');
      setRole('DEVELOPER');
      trackEvent('phantom_member_created');
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.teamList.phantomMemberCreateError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
      {error && (
        <Alert severity="error" sx={{ ...t.type.body }}>
          {error}
        </Alert>
      )}

      <Field
        label={Strings.teamList.phantomFirstNameLabel}
        value={firstName}
        onChangeText={setFirstName}
        placeholder={Strings.teamList.phantomFirstNameLabel}
        required
      />
      <Field
        label={Strings.teamList.phantomLastNamePlaceholder}
        value={lastName}
        onChangeText={setLastName}
        placeholder={Strings.teamList.phantomLastNamePlaceholder}
      />

      <RoleSelectorChips role={role} onSelectRole={setRole} />

      <Button variant="primary" icon="user-plus" onPress={handleCreate} disabled={isLoading} loading={isLoading}>
        {Strings.teamList.addPhantomMemberButton}
      </Button>
    </Box>
  );
}
