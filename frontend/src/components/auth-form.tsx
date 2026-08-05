import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { useAuth } from '@/context/auth-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function AuthForm() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { login } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Animated value for fade and slide transition
  const [fadeAnim] = useState(new Animated.Value(1));

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const handleAuthSubmit = async () => {
    setErrorMessage(null);
    if (!username || !password || (!isLogin && !email)) {
      setErrorMessage(Strings.auth.requiredFieldsError);
      return;
    }

    setFormLoading(true);
    const backendUrl = getBackendUrl();
    const endpoint = isLogin ? 'login' : 'register';
    const payload = isLogin
      ? { username, password }
      : { username, email, password, firstName, lastName };

    try {
      const response = await axios.post(`${backendUrl}/auth/${endpoint}`, payload);
      const data = response.data;

      // Auto-log in on both login and register since both return accessToken and user
      await login(data.accessToken, data.user);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'שגיאה בתהליך ההתחברות/הרשמה.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleForm = () => {
    // Fade out first
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      // Configure layout slide and grow
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsLogin(!isLogin);
      setErrorMessage(null);
      setShowPassword(false); // Reset visibility toggle

      // Fade back in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View
        style={[
          styles.contentCard,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Brand Logo Placeholder */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.logoText, { color: theme.background }]}>
              R
            </ThemedText>
          </View>
          <ThemedText type="title" style={styles.title}>
            {isLogin ? Strings.auth.welcomeBack : Strings.auth.getStarted}
          </ThemedText>
          <ThemedText type="default" style={styles.subtitle}>
            {isLogin
              ? Strings.auth.loginSubtitle
              : Strings.auth.registerSubtitle}
          </ThemedText>
        </View>

        {errorMessage && (
          <View style={[styles.errorBanner, { backgroundColor: colorScheme === 'dark' ? '#b71c1c' : '#ffebee' }]}>
            <ThemedText style={[styles.errorText, { color: colorScheme === 'dark' ? '#ffebee' : '#c62828' }]}>{errorMessage}</ThemedText>
          </View>
        )}

        <View style={styles.formContainer}>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.background,
              },
            ]}
            placeholder={Strings.auth.usernamePlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          {!isLogin && (
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder={Strings.auth.emailPlaceholder}
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}

          {!isLogin && (
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder={Strings.auth.firstNamePlaceholder}
              placeholderTextColor={theme.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
            />
          )}

          {!isLogin && (
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder={Strings.auth.lastNamePlaceholder}
              placeholderTextColor={theme.textSecondary}
              value={lastName}
              onChangeText={setLastName}
            />
          )}

          {/* Password Input with Show/Hide Toggle */}
          <View style={[styles.passwordInputContainer, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
            <TextInput
              style={[
                styles.passwordInput,
                {
                  color: theme.text,
                },
              ]}
              placeholder={Strings.auth.passwordPlaceholder}
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.showPasswordBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <ThemedText style={{ fontSize: 16 }}>
                {showPassword ? '👁️' : '🔒'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.text },
              formLoading && styles.buttonDisabled,
            ]}
            onPress={handleAuthSubmit}
            disabled={formLoading}
          >
            {formLoading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                {isLogin ? Strings.auth.loginButton : Strings.auth.signUpButton}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.toggleLink} onPress={toggleForm}>
          <ThemedText style={{ color: '#007aff', textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>
            {isLogin
              ? Strings.auth.toggleToSignUp
              : Strings.auth.toggleToLogin}
          </ThemedText>
        </TouchableOpacity>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  contentCard: {
    width: '100%',
    maxWidth: 420,
    padding: Spacing.five,
    borderRadius: 12,
    gap: Spacing.three,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  logoContainer: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  logoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 13,
    lineHeight: 18,
  },
  formContainer: {
    gap: Spacing.two,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  passwordInputContainer: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    padding: 0,
  },
  showPasswordBtn: {
    paddingLeft: Spacing.two,
    justifyContent: 'center',
    height: '100%',
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  toggleLink: {
    marginTop: Spacing.one,
    padding: Spacing.one,
  },
  errorBanner: {
    padding: Spacing.two,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#c62828',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
