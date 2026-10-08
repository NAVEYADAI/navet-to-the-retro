import React, { useState } from 'react';
import { Image } from 'react-native';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Card, Field, Button } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { RoleSelectorChips } from './role-selector-chips';
import { buildRegisterPayload, getAuthErrorMessage } from '../auth-helpers';

interface AuthFormWebProps {
  initialEmail?: string;
}

export function AuthFormWeb({ initialEmail }: AuthFormWebProps) {
  const t = useTheme();
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(!initialEmail);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    trackEvent('google_signin_clicked', { screen: 'auth_form' });
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/auth/google/connect`);
      const authUrl = response.data.authUrl;
      if (!authUrl) throw new Error('no authUrl');
      window.location.href = authUrl;
    } catch {
      setErrorMessage(Strings.auth.googleConnectError);
      setGoogleLoading(false);
    }
  };

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
      : buildRegisterPayload({ email, password, firstName, lastName, role });

    try {
      const response = await axios.post(`${getBackendUrl()}/auth/${endpoint}`, payload);
      const token = response.data.accessToken || response.data.access_token;
      const user = response.data.user;
      await login(token, user);
    } catch (err: any) {
      setErrorMessage(getAuthErrorMessage(err, isLogin));
    } finally {
      setFormLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setErrorMessage(null);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${t.space[4]}px`,
        backgroundColor: t.color.bg,
        direction: 'rtl',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Card padding={6}>
          {/* Brand Header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: `${t.space[2]}px` }}>
            <Image source={require('../../../../assets/images/app-logo.png')} style={{ width: 72, height: 72 }} resizeMode="contain" />
            <Typography sx={{ ...t.type.sectionTitle, color: t.color.text }}>
              {isLogin ? Strings.auth.welcomeBack : Strings.auth.getStarted}
            </Typography>
            <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
              {isLogin ? Strings.auth.loginSubtitle : Strings.auth.registerSubtitle}
            </Typography>
          </Box>

          {/* Error Alert */}
          {!!errorMessage && (
            <Alert severity="error" sx={{ ...t.type.caption, borderRadius: `${t.radius.field}px` }}>
              {errorMessage}
            </Alert>
          )}

          {/* Form Fields */}
          <Box
            component="form"
            onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleAuthSubmit(); }}
            sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[4]}px` }}
          >
            {isLogin && (
              <Field
                label={Strings.auth.loginIdentifierLabel}
                placeholder={Strings.auth.loginIdentifierLabel}
                value={username}
                onChangeText={setUsername}
              />
            )}

            {!isLogin && (
              <>
                <Field
                  label={Strings.auth.emailPlaceholder}
                  placeholder={Strings.auth.emailPlaceholder}
                  type="email"
                  value={email}
                  onChangeText={setEmail}
                />

                <Box sx={{ display: 'flex', gap: `${t.space[3]}px` }}>
                  <Box sx={{ flex: 1 }}>
                    <Field
                      label={Strings.auth.firstNamePlaceholder}
                      placeholder={Strings.auth.firstNamePlaceholder}
                      value={firstName}
                      onChangeText={setFirstName}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Field
                      label={Strings.auth.lastNamePlaceholder}
                      placeholder={Strings.auth.lastNamePlaceholder}
                      value={lastName}
                      onChangeText={setLastName}
                    />
                  </Box>
                </Box>

                <RoleSelectorChips role={role} onSelectRole={setRole} />
              </>
            )}

            <Field
              label={Strings.auth.passwordPlaceholder}
              placeholder={Strings.auth.passwordPlaceholder}
              type="password"
              value={password}
              onChangeText={setPassword}
            />

            <Button type="submit" variant="primary" fullWidth loading={formLoading}>
              {isLogin ? Strings.auth.loginButton : Strings.auth.signUpButton}
            </Button>

            <Button variant="ghost" fullWidth onPress={toggleAuthMode}>
              {isLogin ? Strings.auth.toggleToSignUp : Strings.auth.toggleToLogin}
            </Button>
          </Box>

          {/* Google sign-in — additive alongside the password form, not a replacement */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[3]}px` }}>
            <Box sx={{ flex: 1, height: '1px', backgroundColor: t.color.border }} />
            <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
              {Strings.auth.orDividerText}
            </Typography>
            <Box sx={{ flex: 1, height: '1px', backgroundColor: t.color.border }} />
          </Box>

          <Button variant="secondary" fullWidth loading={googleLoading} onPress={handleGoogleSignIn}>
            {Strings.auth.continueWithGoogleButton}
          </Button>
        </Card>
      </Box>
    </Box>
  );
}
