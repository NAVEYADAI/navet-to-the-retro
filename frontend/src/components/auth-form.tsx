import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
  Platform,
} from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const handleAuthSubmit = async () => {
    setErrorMessage(null);
    if (!username || !password || (!isLogin && !email)) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setFormLoading(true);
    const backendUrl = getBackendUrl();
    const endpoint = isLogin ? 'login' : 'register';
    const payload = isLogin
      ? { username, password }
      : { username, email, password, firstName, lastName };

    try {
      const response = await fetch(`${backendUrl}/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Auto-log in on both login and register since both return accessToken and user
      await login(data.accessToken, data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.contentCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
        <ThemedText type="title" style={styles.title}>
          {isLogin ? 'Log In' : 'Sign Up'}
        </ThemedText>
        <ThemedText type="default" style={styles.subtitle}>
          {isLogin
            ? 'Enter your credentials to access your account'
            : 'Create an account to start using the Retro app'}
        </ThemedText>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </View>
        )}

        <View style={styles.formContainer}>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.backgroundElement,
              },
            ]}
            placeholder="Username"
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
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="Email Address"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}

          {!isLogin && (
            <View style={styles.rowInputs}>
              <TextInput
                style={[
                  styles.input,
                  styles.halfInput,
                  {
                    color: theme.text,
                    borderColor: theme.backgroundSelected,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
                placeholder="First Name"
                placeholderTextColor={theme.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.halfInput,
                  {
                    color: theme.text,
                    borderColor: theme.backgroundSelected,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
                placeholder="Last Name"
                placeholderTextColor={theme.textSecondary}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          )}


          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.backgroundElement,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

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
                {isLogin ? 'Log In' : 'Sign Up'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.toggleLink}
          onPress={() => {
            setIsLogin(!isLogin);
            setErrorMessage(null);
          }}
        >
          <ThemedText style={{ color: '#007aff', textAlign: 'center' }}>
            {isLogin
              ? "Don't have an account? Sign up here"
              : 'Already have an account? Log in here'}
          </ThemedText>
        </TouchableOpacity>
      </View>
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
    maxWidth: 400,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
  },
  title: {
    textAlign: 'center',
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: Spacing.two,
  },
  formContainer: {
    gap: Spacing.two,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  halfInput: {
    flex: 1,
  },
  button: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleLink: {
    marginTop: Spacing.two,
    padding: Spacing.one,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
});
