import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Button, TextField, Collapse, CircularProgress, Alert } from '@mui/material';
import type { TeamListTheme } from '@/features/teams/types';

interface AddMemberFormProps {
  teamId: number;
  token: string;
  isVisible: boolean;
  onInviteSent: () => void;
  theme: TeamListTheme;
}

export function AddMemberForm({ teamId, token, isVisible, onInviteSent, theme }: AddMemberFormProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddMember = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('נא למלא כתובת אימייל.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${teamId}/members`, {
        username: trimmed
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setUsername('');
      onInviteSent();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בהוספת חבר צוות.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Collapse in={isVisible} timeout="auto" unmountOnExit>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, mt: 1, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 'bold', color: theme.text, fontSize: 13, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
          הזמנת חבר חדש לצוות
        </Typography>

        {error && (
          <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.textSecondary, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
            כתובת אימייל
          </Typography>
          <TextField
            placeholder="הכנס כתובת אימייל"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
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
          onClick={handleAddMember}
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
          {isLoading ? <CircularProgress size={20} color="inherit" /> : Strings.teamList.addMemberButton}
        </Button>
      </Box>
    </Collapse>
  );
}
