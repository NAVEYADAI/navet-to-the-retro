import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { ThemedView } from './themed-view';
import { Spacing, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { useAuth } from '@/context/auth-context';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Fade,
  IconButton,
  InputAdornment,
} from '@mui/material';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function AuthForm() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const isDark = colorScheme === 'dark';
  const { login } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const handleAuthSubmit = async () => {
    setErrorMessage(null);
    const hasInvalidFields = isLogin ? !username : (!email || !password);
    if (hasInvalidFields || !password) {
      setErrorMessage(Strings.auth.requiredFieldsError);
      return;
    }

    setFormLoading(true);
    const backendUrl = getBackendUrl();
    const endpoint = isLogin ? 'login' : 'register';
    const payload = isLogin
      ? { username, password }
      : { username: email, email, password, firstName, lastName, role };

    try {
      const response = await axios.post(`${backendUrl}/auth/${endpoint}`, payload);
      const data = response.data;
      await login(data.accessToken, data.user);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'שגיאה בתהליך ההתחברות/הרשמה.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleForm = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsLogin(!isLogin);
    setErrorMessage(null);
    setShowPassword(false);
  };

  if (Platform.OS !== 'web') {
    // Native fallback (keep existing RN-only auth form logic)
    return <AuthFormNative />;
  }

  // ── WEB: Premium MUI Auth ──

  const accent = isDark ? '#818cf8' : '#6366f1';
  const accentHover = isDark ? '#a5b4fc' : '#4f46e5';
  const cardBg = isDark ? 'rgba(15,15,24,0.92)' : 'rgba(255,255,255,0.95)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      borderRadius: '12px',
      fontFamily: 'Rubik, sans-serif',
      transition: 'all 0.2s ease',
      '&:hover fieldset': { borderColor: accent },
      '&.Mui-focused fieldset': { borderColor: accent, borderWidth: 2 },
      fieldset: { borderColor: cardBorder },
    },
    '& .MuiInputLabel-root': {
      fontFamily: 'Rubik, sans-serif',
      color: theme.textSecondary,
      right: 28,
      left: 'auto',
      '&.Mui-focused': { color: accent },
    },
    input: { color: theme.text, textAlign: 'right', fontFamily: 'Rubik, sans-serif' },
  };

  const roles = [
    { label: 'ראש צוות', value: 'TEAM_LEADER', emoji: '👑' },
    { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER', emoji: '📋' },
    { label: 'מפתח', value: 'DEVELOPER', emoji: '💻' },
    { label: 'QA', value: 'TESTER', emoji: '🧪' },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 50%), #0a0a0f'
          : 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.04) 0%, transparent 50%), #fafbff',
        p: 3,
        direction: 'rtl',
      }}
    >
      <Fade in={true} timeout={600}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 440,
            backgroundColor: cardBg,
            borderRadius: '24px',
            border: `1px solid ${cardBorder}`,
            boxShadow: isDark
              ? '0 24px 48px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.05) inset'
              : '0 24px 48px rgba(0,0,0,0.06), 0 0 1px rgba(255,255,255,0.8) inset',
            backdropFilter: 'blur(20px)',
            p: { xs: 4, sm: 5 },
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          {/* Brand Logo */}
          <Box sx={{ textAlign: 'center', mb: 1 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${accent} 0%, #8b5cf6 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
                boxShadow: `0 8px 24px ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.25)'}`,
                animation: 'float 4s ease-in-out infinite',
              }}
            >
              <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 24, fontFamily: 'Rubik, sans-serif' }}>
                R
              </Typography>
            </Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 800, color: theme.text, fontFamily: 'Rubik, sans-serif', mb: 0.5, letterSpacing: -0.5 }}
            >
              {isLogin ? Strings.auth.welcomeBack : Strings.auth.getStarted}
            </Typography>
            <Typography sx={{ color: theme.textSecondary, fontSize: 14, fontFamily: 'Rubik, sans-serif', lineHeight: 1.5 }}>
              {isLogin ? Strings.auth.loginSubtitle : Strings.auth.registerSubtitle}
            </Typography>
          </Box>

          {/* Error Message */}
          {errorMessage && (
            <Fade in={true}>
              <Alert
                severity="error"
                sx={{
                  borderRadius: '12px',
                  fontFamily: 'Rubik, sans-serif',
                  flexDirection: 'row-reverse',
                  textAlign: 'right',
                  animation: 'fadeInUp 0.3s ease both',
                }}
              >
                {errorMessage}
              </Alert>
            </Fade>
          )}

          {/* Form Fields */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {isLogin && (
              <TextField
                label="כתובת אימייל"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                size="small"
                autoCapitalize="none"
                type="email"
                sx={inputSx}
              />
            )}

            {!isLogin && (
              <>
                <TextField
                  label={Strings.auth.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  size="small"
                  autoCapitalize="none"
                  type="email"
                  sx={inputSx}
                />
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label={Strings.auth.firstNamePlaceholder}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    size="small"
                    sx={{ ...inputSx, flex: 1 }}
                  />
                  <TextField
                    label={Strings.auth.lastNamePlaceholder}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    size="small"
                    sx={{ ...inputSx, flex: 1 }}
                  />
                </Box>

                {/* Role Selection */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
                    תפקיד מקצועי
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 1 }}>
                    {roles.map((r) => {
                      const isSelected = role === r.value;
                      return (
                        <Chip
                          key={r.value}
                          label={`${r.emoji} ${r.label}`}
                          clickable
                          onClick={() => setRole(r.value)}
                          sx={{
                            backgroundColor: isSelected ? accent : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                            color: isSelected ? '#fff' : theme.text,
                            fontFamily: 'Rubik, sans-serif',
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: 12,
                            borderRadius: '10px',
                            border: `1px solid ${isSelected ? accent : 'transparent'}`,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: isSelected ? accentHover : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                              transform: 'translateY(-1px)',
                            },
                          }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              </>
            )}

            {/* Password Field */}
            <TextField
              label={Strings.auth.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              size="small"
              autoCapitalize="none"
              sx={inputSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="start"
                        size="small"
                        sx={{ color: theme.textSecondary }}
                      >
                        <span style={{ fontSize: 16 }}>{showPassword ? '👁️' : '🔒'}</span>
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Submit Button */}
            <Button
              variant="contained"
              onClick={handleAuthSubmit}
              disabled={formLoading}
              fullWidth
              sx={{
                background: `linear-gradient(135deg, ${accent} 0%, #8b5cf6 100%)`,
                color: '#fff',
                fontWeight: 700,
                fontFamily: 'Rubik, sans-serif',
                fontSize: 15,
                textTransform: 'none',
                borderRadius: '12px',
                py: 1.4,
                mt: 1,
                boxShadow: `0 4px 16px ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.25)'}`,
                transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                '&:hover': {
                  background: `linear-gradient(135deg, ${accentHover} 0%, #7c3aed 100%)`,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 8px 24px ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
                '&.Mui-disabled': {
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                },
              }}
            >
              {formLoading ? (
                <CircularProgress size={22} sx={{ color: '#fff' }} />
              ) : (
                isLogin ? Strings.auth.loginButton : Strings.auth.signUpButton
              )}
            </Button>
          </Box>

          {/* Toggle Link */}
          <Button
            variant="text"
            onClick={toggleForm}
            sx={{
              color: accent,
              fontWeight: 700,
              fontFamily: 'Rubik, sans-serif',
              fontSize: 13,
              textTransform: 'none',
              '&:hover': { backgroundColor: `${accent}10` },
            }}
          >
            {isLogin ? Strings.auth.toggleToSignUp : Strings.auth.toggleToLogin}
          </Button>
        </Box>
      </Fade>
    </Box>
  );
}

/* ── NATIVE FALLBACK (kept for non-web platforms) ── */
function AuthFormNative() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { login } = useAuth();
  const { TextInput, TouchableOpacity, ActivityIndicator } = require('react-native');

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const { ThemedText } = require('./themed-text');

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const handleAuthSubmit = async () => {
    setErrorMessage(null);
    const hasInvalidFields = isLogin ? !username : (!email || !password);
    if (hasInvalidFields || !password) {
      setErrorMessage(Strings.auth.requiredFieldsError);
      return;
    }

    setFormLoading(true);
    const backendUrl = getBackendUrl();
    const endpoint = isLogin ? 'login' : 'register';
    const payload = isLogin
      ? { username, password }
      : { username: email, email, password, firstName, lastName, role };

    try {
      const response = await axios.post(`${backendUrl}/auth/${endpoint}`, payload);
      const data = response.data;
      await login(data.accessToken, data.user);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'שגיאה בתהליך ההתחברות/הרשמה.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleForm = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsLogin(!isLogin);
      setErrorMessage(null);
      setShowPassword(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <ThemedView style={[nativeStyles.container, { backgroundColor: theme.background }]}>
      <Animated.View
        style={[
          nativeStyles.contentCard,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <View style={nativeStyles.logoContainer}>
          <View style={[nativeStyles.logoCircle, { backgroundColor: theme.text }]}>
            <ThemedText style={[nativeStyles.logoText, { color: theme.background }]}>R</ThemedText>
          </View>
          <ThemedText type="title" style={nativeStyles.title}>
            {isLogin ? Strings.auth.welcomeBack : Strings.auth.getStarted}
          </ThemedText>
          <ThemedText type="default" style={nativeStyles.subtitle}>
            {isLogin ? Strings.auth.loginSubtitle : Strings.auth.registerSubtitle}
          </ThemedText>
        </View>

        {errorMessage && (
          <View style={[nativeStyles.errorBanner, { backgroundColor: colorScheme === 'dark' ? '#b71c1c' : '#ffebee' }]}>
            <ThemedText style={[nativeStyles.errorText, { color: colorScheme === 'dark' ? '#ffebee' : '#c62828' }]}>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        <View style={nativeStyles.formContainer}>
          {isLogin && (
            <TextInput
              style={[nativeStyles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
              placeholder="כתובת אימייל"
              placeholderTextColor={theme.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          )}

          {!isLogin && (
            <>
              <TextInput
                style={[nativeStyles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
                placeholder={Strings.auth.emailPlaceholder}
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[nativeStyles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
                placeholder={Strings.auth.firstNamePlaceholder}
                placeholderTextColor={theme.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={[nativeStyles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
                placeholder={Strings.auth.lastNamePlaceholder}
                placeholderTextColor={theme.textSecondary}
                value={lastName}
                onChangeText={setLastName}
              />
              <View style={{ gap: Spacing.one, marginVertical: Spacing.one, paddingHorizontal: 4 }}>
                <ThemedText style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', color: theme.textSecondary }}>
                  תפקיד מקצועי:
                </ThemedText>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.two, marginTop: 4 }}>
                  {[
                    { label: 'ראש צוות', value: 'TEAM_LEADER' },
                    { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER' },
                    { label: 'מפתח', value: 'DEVELOPER' },
                    { label: 'QA', value: 'TESTER' },
                  ].map((r) => {
                    const isSelected = role === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={{
                          backgroundColor: isSelected ? theme.text : theme.backgroundElement,
                          borderColor: isSelected ? theme.text : theme.backgroundSelected,
                          borderWidth: 1,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                        }}
                        onPress={() => setRole(r.value)}
                      >
                        <ThemedText style={{ color: isSelected ? theme.background : theme.text, fontSize: 12, fontWeight: 'bold' }}>
                          {r.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          <View style={[nativeStyles.passwordInputContainer, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
            <TextInput
              style={[nativeStyles.passwordInput, { color: theme.text }]}
              placeholder={Strings.auth.passwordPlaceholder}
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={nativeStyles.showPasswordBtn} onPress={() => setShowPassword(!showPassword)}>
              <ThemedText style={{ fontSize: 16 }}>{showPassword ? '👁️' : '🔒'}</ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[nativeStyles.button, { backgroundColor: theme.text }, formLoading && nativeStyles.buttonDisabled]}
            onPress={handleAuthSubmit}
            disabled={formLoading}
          >
            {formLoading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[nativeStyles.buttonText, { color: theme.background }]}>
                {isLogin ? Strings.auth.loginButton : Strings.auth.signUpButton}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={nativeStyles.toggleLink} onPress={toggleForm}>
          <ThemedText style={{ color: '#6366f1', textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>
            {isLogin ? Strings.auth.toggleToSignUp : Strings.auth.toggleToLogin}
          </ThemedText>
        </TouchableOpacity>
      </Animated.View>
    </ThemedView>
  );
}

const nativeStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  contentCard: { width: '100%', maxWidth: 420, padding: Spacing.five, borderRadius: 12, gap: Spacing.three, borderWidth: 1 },
  logoContainer: { alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.one },
  logoCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.two },
  logoText: { fontSize: 22, fontWeight: 'bold' },
  title: { textAlign: 'center', fontSize: 24, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', opacity: 0.7, fontSize: 13, lineHeight: 18 },
  formContainer: { gap: Spacing.two },
  input: { height: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, fontSize: 15, textAlign: 'right' },
  passwordInputContainer: { height: 46, borderWidth: 1, borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: Spacing.three },
  passwordInput: { flex: 1, height: '100%', fontSize: 15, padding: 0, textAlign: 'right' },
  showPasswordBtn: { paddingRight: Spacing.two, justifyContent: 'center', height: '100%' },
  button: { height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.two },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: 'bold' },
  toggleLink: { marginTop: Spacing.one, padding: Spacing.one },
  errorBanner: { padding: Spacing.two, borderRadius: 6, borderRightWidth: 4, borderRightColor: '#c62828' },
  errorText: { fontSize: 13, textAlign: 'right', fontWeight: 'bold' },
});
