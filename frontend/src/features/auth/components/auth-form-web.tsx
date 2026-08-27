import React, { useState } from 'react';
import { Image } from 'react-native';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { RoleSelectorChips } from './role-selector-chips';
import { getAuthContainerSx, getAuthCardSx, getAuthTextFieldSx } from '../styles/auth.web.styles';

interface AuthFormWebProps {
  isDark: boolean;
  initialEmail?: string;
}

export function AuthFormWeb({ isDark, initialEmail }: AuthFormWebProps) {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(!initialEmail);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const accent = isDark ? '#818cf8' : '#6366f1';

  const handleAuthSubmit = async () => {
    setErrorMessage(null);
    const hasInvalidFields = isLogin ? !username : (!email || !password);
    if (hasInvalidFields || !password) {
      setErrorMessage(Strings.auth.requiredFieldsError);
      return;
    }

    setFormLoading(true);
    const endpoint = isLogin ? 'login' : 'register';
    const payload = isLogin
      ? { username, password }
      : {
          username: email.split('@')[0],
          email,
          password,
          firstName,
          lastName,
          role,
        };

    try {
      const response = await axios.post(`${getBackendUrl()}/auth/${endpoint}`, payload);
      const token = response.data.accessToken || response.data.access_token;
      const user = response.data.user;
      await login(token, user);
    } catch (err: any) {
      setErrorMessage(
          'שגיאה בתהליך ההתחברות/הרשמה.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setErrorMessage(null);
    setShowPassword(false);
  };

  const inputSx = getAuthTextFieldSx(isDark);

  return (
    <Box sx={getAuthContainerSx(isDark)}>
      <Box sx={getAuthCardSx(isDark)}>
        {/* Brand Header */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3.5, textAlign: 'center' }}>
          <Box
            sx={{
              mb: 2,
              filter: `drop-shadow(0 8px 20px ${isDark ? 'rgba(129,140,248,0.3)' : 'rgba(99,102,241,0.25)'})`,
              animation: 'float 4s ease-in-out infinite',
            }}
          >
            <Image source={require('../../../../assets/images/app-logo.png')} style={{ width: 88, height: 88 }} resizeMode="contain" />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: isDark ? '#fff' : '#1e1e2d', fontFamily: 'Rubik, sans-serif', mb: 0.5 }}>
            {isLogin ? Strings.auth.welcomeBack : Strings.auth.getStarted}
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: 'Rubik, sans-serif', fontSize: 13 }}>
            {isLogin ? Strings.auth.loginSubtitle : Strings.auth.registerSubtitle}
          </Typography>
        </Box>

        {/* Error Alert */}
        {!!errorMessage && (
          <Alert
            severity="error"
            sx={{
              mb: 2.5,
              borderRadius: '12px',
              fontFamily: 'Rubik, sans-serif',
              fontSize: 13,
              direction: 'rtl',
              textAlign: 'right',
              '& .MuiAlert-icon': { ml: 1, mr: 0 },
            }}
          >
            {errorMessage}
          </Alert>
        )}

        {/* Form Fields */}
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleAuthSubmit(); }} sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>
          {isLogin && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.8, direction: 'rtl' }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, #c084fc 100%)`, boxShadow: `0 0 8px ${accent}` }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: 'Rubik, sans-serif' }}>
                  {Strings.auth.usernamePlaceholder}
                </Typography>
              </Box>
              <TextField
                placeholder={Strings.auth.usernamePlaceholder}
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                size="small"
                autoCapitalize="none"
                type="text"
                sx={inputSx}
              />
            </Box>
          )}

          {!isLogin && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.8, direction: 'rtl' }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, #c084fc 100%)`, boxShadow: `0 0 8px ${accent}` }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: 'Rubik, sans-serif' }}>
                    {Strings.auth.emailPlaceholder}
                  </Typography>
                </Box>
                <TextField
                  placeholder={Strings.auth.emailPlaceholder}
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  size="small"
                  autoCapitalize="none"
                  type="email"
                  sx={inputSx}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.8, direction: 'rtl' }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, #c084fc 100%)`, boxShadow: `0 0 8px ${accent}` }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: 'Rubik, sans-serif' }}>
                      {Strings.auth.firstNamePlaceholder}
                    </Typography>
                  </Box>
                  <TextField
                    placeholder={Strings.auth.firstNamePlaceholder}
                    value={firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                    size="small"
                    sx={inputSx}
                  />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.8, direction: 'rtl' }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, #c084fc 100%)`, boxShadow: `0 0 8px ${accent}` }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: 'Rubik, sans-serif' }}>
                      {Strings.auth.lastNamePlaceholder}
                    </Typography>
                  </Box>
                  <TextField
                    placeholder={Strings.auth.lastNamePlaceholder}
                    value={lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                    size="small"
                    sx={inputSx}
                  />
                </Box>
              </Box>
              <RoleSelectorChips role={role} onSelectRole={setRole} accent={accent} isDark={isDark} />
            </>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.8, direction: 'rtl' }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, #c084fc 100%)`, boxShadow: `0 0 8px ${accent}` }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: 'Rubik, sans-serif' }}>
                {Strings.auth.passwordPlaceholder}
              </Typography>
            </Box>
            <TextField
              placeholder={Strings.auth.passwordPlaceholder}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              size="small"
              sx={inputSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="start"
                        size="small"
                        sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}
                      >
                        {showPassword ? '👁️' : '🔒'}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          <Button
            type="submit"
            disabled={formLoading}
            variant="contained"
            sx={{
              mt: 1,
              py: 1.3,
              borderRadius: '12px',
              fontFamily: 'Rubik, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              textTransform: 'none',
              background: `linear-gradient(135deg, ${accent} 0%, #8b5cf6 100%)`,
              boxShadow: `0 4px 16px ${isDark ? 'rgba(129,140,248,0.3)' : 'rgba(99,102,241,0.3)'}`,
              transition: 'all 0.25s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: `0 8px 24px ${isDark ? 'rgba(129,140,248,0.4)' : 'rgba(99,102,241,0.4)'}`,
              },
            }}
          >
            {formLoading ? (
              <CircularProgress size={22} sx={{ color: '#fff' }} />
            ) : isLogin ? (
              Strings.auth.loginButton
            ) : (
              Strings.auth.signUpButton
            )}
          </Button>

          <Button
            onClick={toggleAuthMode}
            sx={{
              color: accent,
              fontFamily: 'Rubik, sans-serif',
              fontWeight: 600,
              fontSize: 13,
              textTransform: 'none',
              mt: 0.5,
              '&:hover': { background: 'transparent', opacity: 0.8 },
            }}
          >
            {isLogin ? Strings.auth.toggleToSignUp : Strings.auth.toggleToLogin}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
