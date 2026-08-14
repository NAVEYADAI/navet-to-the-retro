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
  Fade,
  Grow,
} from '@mui/material';
import { getSettingsCardSx, getSettingsInputSx } from '../styles/settings.styles';

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
  isDark: boolean;
  accent: string;
  themeColors: {
    text: string;
    textSecondary: string;
    backgroundElement: string;
    backgroundSelected: string;
  };
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
  isDark,
  accent,
  themeColors,
}: ProfileFormCardProps) {
  const cardSx = getSettingsCardSx(isDark);
  const inputSx = getSettingsInputSx(themeColors);

  return (
    <Grow in={true} timeout={400}>
      <Card sx={cardSx}>
        <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
            👤 עדכון פרטים אישיים
          </Typography>

          {profileMessage && (
            <Fade in={true}>
              <Alert
                severity={profileMessage.isError ? 'error' : 'success'}
                sx={{ flexDirection: 'row-reverse', textAlign: 'right', borderRadius: '12px', fontFamily: 'Rubik, sans-serif' }}
              >
                {profileMessage.text}
              </Alert>
            </Fade>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.8, direction: 'rtl' }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, #c084fc 100%)`, boxShadow: `0 0 8px ${accent}` }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                  שם פרטי
                </Typography>
              </Box>
              <TextField
                placeholder="הכנס שם פרטי"
                value={firstName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                size="small"
                sx={inputSx}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.8, direction: 'rtl' }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, #c084fc 100%)`, boxShadow: `0 0 8px ${accent}` }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                  שם משפחה
                </Typography>
              </Box>
              <TextField
                placeholder="הכנס שם משפחה"
                value={lastName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                size="small"
                sx={inputSx}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.8, direction: 'rtl' }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, #c084fc 100%)`, boxShadow: `0 0 8px ${accent}` }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: themeColors.text, fontFamily: 'Rubik, sans-serif' }}>
                  כתובת אימייל
                </Typography>
              </Box>
              <TextField
                placeholder="הכנס כתובת אימייל"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                size="small"
                sx={inputSx}
              />
            </Box>
          </Box>

          <Button
            variant="contained"
            onClick={onUpdateProfile}
            disabled={profileLoading}
            sx={{
              background: `linear-gradient(135deg, ${accent} 0%, #8b5cf6 100%)`,
              color: '#fff',
              fontWeight: 700,
              fontFamily: 'Rubik, sans-serif',
              textTransform: 'none',
              borderRadius: '12px',
              py: 1.2,
              boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
              transition: 'all 0.25s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
              },
              '&.Mui-disabled': {
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              },
            }}
          >
            {profileLoading ? (
              <CircularProgress size={22} sx={{ color: '#fff' }} />
            ) : (
              'שמור שינויים'
            )}
          </Button>
        </CardContent>
      </Card>
    </Grow>
  );
}
