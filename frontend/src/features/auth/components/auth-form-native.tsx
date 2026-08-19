import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { authNativeStyles } from '../styles/auth.styles';

interface AuthFormNativeProps {
  theme: any;
  colorScheme: string;
}

export function AuthFormNative({ theme, colorScheme }: AuthFormNativeProps) {
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

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 0,
      useNativeDriver: false,
    }).start();
  }, [isLogin]);

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
      : { username: email, email, password, firstName, lastName, role };

    try {
      const response = await axios.post(`${getBackendUrl()}/auth/${endpoint}`, payload);
      const data = response.data;
      const token = data.accessToken || data.access_token;
      await login(token, data.user);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'שגיאה בתהליך ההתחברות/הרשמה.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setErrorMessage(null);
    setShowPassword(false);
  };

  return (
    <ThemedView style={authNativeStyles.container}>
      <Animated.View
        style={[
          authNativeStyles.contentCard,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <View style={authNativeStyles.logoContainer}>
          <Image source={require('../../../../assets/images/app-logo.png')} style={{ width: 88, height: 88, marginBottom: 8 }} resizeMode="contain" />
          <ThemedText type="title" style={authNativeStyles.title}>
            {isLogin ? Strings.auth.welcomeBack : Strings.auth.getStarted}
          </ThemedText>
          <ThemedText type="default" style={authNativeStyles.subtitle}>
            {isLogin ? Strings.auth.loginSubtitle : Strings.auth.registerSubtitle}
          </ThemedText>
        </View>

        {errorMessage && (
          <View style={[authNativeStyles.errorBanner, { backgroundColor: colorScheme === 'dark' ? '#b71c1c' : '#ffebee' }]}>
            <ThemedText style={[authNativeStyles.errorText, { color: colorScheme === 'dark' ? '#ffebee' : '#c62828' }]}>
              {errorMessage}
            </ThemedText>
          </View>
        )}

        <View style={authNativeStyles.formContainer}>
          {isLogin && (
            <TextInput
              style={[authNativeStyles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
              placeholder={Strings.auth.usernamePlaceholder}
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
                style={[authNativeStyles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
                placeholder={Strings.auth.emailPlaceholder}
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[authNativeStyles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
                placeholder={Strings.auth.firstNamePlaceholder}
                placeholderTextColor={theme.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={[authNativeStyles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
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
                    { label: 'DevOps', value: 'DEVOPS' },
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

          <View style={[authNativeStyles.passwordInputContainer, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
            <TextInput
              style={[authNativeStyles.passwordInput, { color: theme.text }]}
              placeholder={Strings.auth.passwordPlaceholder}
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={authNativeStyles.showPasswordBtn} onPress={() => setShowPassword(!showPassword)}>
              <ThemedText style={{ fontSize: 16 }}>{showPassword ? '👁️' : '🔒'}</ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[authNativeStyles.button, { backgroundColor: theme.text }, formLoading && authNativeStyles.buttonDisabled]}
            onPress={handleAuthSubmit}
            disabled={formLoading}
          >
            {formLoading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[authNativeStyles.buttonText, { color: theme.background }]}>
                {isLogin ? Strings.auth.loginButton : Strings.auth.signUpButton}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={authNativeStyles.toggleLink} onPress={toggleForm}>
          <ThemedText style={{ color: '#6366f1', textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>
            {isLogin ? Strings.auth.toggleToSignUp : Strings.auth.toggleToLogin}
          </ThemedText>
        </TouchableOpacity>
      </Animated.View>
    </ThemedView>
  );
}
