import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Button, Card, Field } from '@/components/ui';

interface ProfileFormCardProps {
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  profileLoading: boolean;
  profileMessage: { text: string; isError: boolean } | null;
  onUpdateProfile: () => void;
}

export function ProfileFormCard({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  profileLoading,
  profileMessage,
  onUpdateProfile,
}: ProfileFormCardProps) {
  const t = useTheme();

  return (
    <Card padding={5}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
          עדכון פרטים אישיים
        </Typography>
      </Box>

      {profileMessage ? (
        <Alert severity={profileMessage.isError ? 'error' : 'success'} sx={{ ...t.type.body }}>
          {profileMessage.text}
        </Alert>
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[4]}px` }}>
        <Field label="שם פרטי" value={firstName} onChangeText={setFirstName} placeholder="הכנס שם פרטי" />
        <Field label="שם משפחה" value={lastName} onChangeText={setLastName} placeholder="הכנס שם משפחה" />
        <Field label="כתובת אימייל" value={email} onChangeText={setEmail} type="email" placeholder="הכנס כתובת אימייל" />
      </Box>

      <Button variant="primary" onPress={onUpdateProfile} disabled={profileLoading} loading={profileLoading}>
        שמור שינויים
      </Button>
    </Card>
  );
}
