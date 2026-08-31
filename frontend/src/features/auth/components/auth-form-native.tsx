import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';

interface AuthFormNativeProps {
  initialEmail?: string;
}

const ROLES = [
  { label: 'ראש צוות', value: 'TEAM_LEADER' },
  { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER' },
  { label: 'מפתח', value: 'DEVELOPER' },
  { label: 'QA / בודק', value: 'TESTER' },
  { label: 'DevOps', value: 'DEVOPS' },
];

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function AuthFormNative({ initialEmail }: AuthFormNativeProps) {
  const t = useTheme();
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

  const inputStyle: TextStyle = {
    ...rnText(t.type.body),
    height: t.layout.minTouchTarget,
    borderWidth: 1,
    borderRadius: t.radius.field,
    paddingHorizontal: t.space[3],
    textAlign: 'right',
    color: t.color.text,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: t.space[5] }}>
      <View
        style={{
          width: '100%',
          maxWidth: 420,
          padding: t.space[6],
          borderRadius: t.radius.card,
          gap: t.space[4],
          borderWidth: 1,
          backgroundColor: t.color.surface,
          borderColor: t.color.border,
        }}
      >
        <View style={{ alignItems: 'center', gap: t.space[1] }}>
          <Image
            source={require('../../../../assets/images/app-logo.png')}
            style={{ width: 88, height: 88, marginBottom: t.space[1] }}
            resizeMode="contain"
          />
          <Text style={[rnText(t.type.sectionTitle), { color: t.color.text, textAlign: 'center' }]}>
            {isLogin ? Strings.auth.welcomeBack : Strings.auth.getStarted}
          </Text>
          <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'center' }]}>
            {isLogin ? Strings.auth.loginSubtitle : Strings.auth.registerSubtitle}
          </Text>
        </View>

        {!!errorMessage && (
          <View
            style={{
              backgroundColor: t.color.status.danger.bg,
              borderWidth: 1,
              borderColor: t.color.status.danger.border,
              borderRadius: t.radius.field,
              padding: t.space[2],
            }}
          >
            <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        <View style={{ gap: t.space[3] }}>
          {isLogin && (
            <TextInput
              style={inputStyle}
              placeholder={Strings.auth.usernamePlaceholder}
              placeholderTextColor={t.color.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          )}

          {!isLogin && (
            <>
              <TextInput
                style={inputStyle}
                placeholder={Strings.auth.emailPlaceholder}
                placeholderTextColor={t.color.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={inputStyle}
                placeholder={Strings.auth.firstNamePlaceholder}
                placeholderTextColor={t.color.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={inputStyle}
                placeholder={Strings.auth.lastNamePlaceholder}
                placeholderTextColor={t.color.textSecondary}
                value={lastName}
                onChangeText={setLastName}
              />

              <View style={{ gap: t.space[1] }}>
                <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.textSecondary, textAlign: 'right' }]}>
                  תפקיד מקצועי
                </Text>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
                  {ROLES.map((r) => {
                    const isSelected = role === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={{
                          backgroundColor: isSelected ? t.color.accent.subtle : t.color.surfaceSubtle,
                          borderColor: isSelected ? t.color.accent.border : t.color.border,
                          borderWidth: 1,
                          paddingHorizontal: t.space[3],
                          paddingVertical: t.space[1],
                          borderRadius: t.radius.badge,
                        }}
                        onPress={() => setRole(r.value)}
                      >
                        <Text style={[rnText({ ...t.type.caption, fontWeight: isSelected ? 700 : 500 }), { color: isSelected ? t.color.accent.base : t.color.textSecondary }]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: t.space[2],
              height: t.layout.minTouchTarget,
              borderWidth: 1,
              borderRadius: t.radius.field,
              paddingHorizontal: t.space[3],
              borderColor: t.color.border,
              backgroundColor: t.color.surface,
            }}
          >
            <TextInput
              style={[rnText(t.type.body), { flex: 1, height: '100%', padding: 0, color: t.color.text, textAlign: 'right' }]}
              placeholder={Strings.auth.passwordPlaceholder}
              placeholderTextColor={t.color.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Icon name={showPassword ? 'eye' : 'eye-off'} size="sm" tone="muted" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={{
              height: t.layout.minTouchTarget,
              borderRadius: t.radius.field,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: t.color.accent.base,
              opacity: formLoading ? 0.6 : 1,
            }}
            onPress={handleAuthSubmit}
            disabled={formLoading}
          >
            {formLoading ? (
              <ActivityIndicator color={t.color.accent.onBase} />
            ) : (
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
                {isLogin ? Strings.auth.loginButton : Strings.auth.signUpButton}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={toggleForm} style={{ paddingVertical: t.space[1] }}>
          <Text style={[rnText(t.type.label), { color: t.color.accent.base, textAlign: 'center' }]}>
            {isLogin ? Strings.auth.toggleToSignUp : Strings.auth.toggleToLogin}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
