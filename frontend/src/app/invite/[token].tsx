import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform, type TextStyle } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import axios from 'axios';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthForm } from '@/components/auth-form';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { getBackendUrl } from '@/api/config';
import { trackEvent } from '@/lib/analytics';

type Status = 'loading' | 'invalid' | 'ready' | 'joining' | 'done' | 'error';

interface InviteInfo {
  teamName: string;
  email: string | null;
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decision #3): a
  // conversion link (not a regular join link) — routes to a dedicated form below instead of
  // <AuthForm>, and comes with a prefill for the phantom's existing display name.
  type: 'join' | 'phantomConversion';
  prefill?: { firstName: string | null; lastName: string | null };
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

// Feature 9 (phantom members, §9.2): dedicated form for completing a phantom-member conversion —
// fills in username/email/password on the phantom's *existing* User row (no Authorization header,
// there's no logged-in user yet), then logs the returned session straight in. Deliberately not
// <AuthForm> (which always registers a brand-new user).
function PhantomConversionForm({ inviteToken, teamName, prefill }: {
  inviteToken: string;
  teamName: string;
  prefill?: { firstName: string | null; lastName: string | null };
}) {
  const t = useTheme();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState(prefill?.firstName || '');
  const [lastName, setLastName] = useState(prefill?.lastName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle = [
    rnText(t.type.body),
    {
      height: t.layout.minTouchTarget,
      borderWidth: 1,
      borderRadius: t.radius.field,
      paddingHorizontal: t.space[2],
      textAlign: 'right' as const,
      color: t.color.text,
      borderColor: t.color.border,
      backgroundColor: t.color.surface,
    },
  ];

  const handleSubmit = async () => {
    setError(null);
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError(Strings.auth.requiredFieldsError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${getBackendUrl()}/invites/${inviteToken}/consume-phantom-conversion`, {
        username: username.trim(),
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      await login(response.data.accessToken, response.data.user);
      trackEvent('phantom_conversion_completed');

      // Same reload pattern as the regular join flow below (see consumeInvite) — a client-side
      // router.replace() here crashes expo-router/ui's <Tabs>.
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.invites.phantomConversionError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four, gap: t.space[2] }}>
      <Text style={[rnText(t.type.sectionTitle), { color: t.color.text, textAlign: 'center' }]}>
        {Strings.invites.phantomConversionTitle(teamName)}
      </Text>
      <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'center' }]}>
        {Strings.invites.phantomConversionSubtitle}
      </Text>

      {!!error && (
        <View
          style={{
            backgroundColor: t.color.status.danger.bg,
            borderWidth: 1,
            borderColor: t.color.status.danger.border,
            borderRadius: t.radius.field,
            padding: t.space[2],
          }}
        >
          <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'center' }]}>
            {error}
          </Text>
        </View>
      )}

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
      <TextInput
        style={inputStyle}
        placeholder={Strings.auth.usernamePlaceholder}
        placeholderTextColor={t.color.textSecondary}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={inputStyle}
        placeholder={Strings.auth.emailPlaceholder}
        placeholderTextColor={t.color.textSecondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={inputStyle}
        placeholder={Strings.auth.passwordPlaceholder}
        placeholderTextColor={t.color.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={{
          height: t.layout.minTouchTarget,
          borderRadius: t.radius.field,
          backgroundColor: t.color.accent.base,
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: t.space[1],
        }}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={t.color.accent.onBase} />
        ) : (
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
            {Strings.invites.phantomConversionSubmitButton}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function InvitePage() {
  const { token: inviteToken } = useLocalSearchParams<{ token: string }>();
  const { token: authToken } = useAuth();
  const t = useTheme();

  const [status, setStatus] = useState<Status>('loading');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await axios.get(`${getBackendUrl()}/invites/${inviteToken}`);
        if (cancelled) return;
        if (!response.data.valid) {
          setErrorMessage(response.data.reason || null);
          setStatus('invalid');
        } else {
          setInviteInfo({
            teamName: response.data.teamName,
            email: response.data.email,
            type: response.data.type || 'join',
            prefill: response.data.prefill,
          });
          setStatus('ready');
        }
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err.response?.data?.message || null);
        setStatus('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, [inviteToken]);

  const consumeInvite = useCallback(async () => {
    setStatus('joining');
    try {
      await axios.post(`${getBackendUrl()}/invites/${inviteToken}/consume`, {}, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      setStatus('done');
      // A client-side router.replace() here crashes expo-router/ui's <Tabs> (it doesn't
      // handle mounting fresh right after a same-session Slot→Tabs transition) — a full
      // reload sidesteps it entirely and is proven to work (see _layout.tsx's auth gate).
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || Strings.invites.joinFailedError);
      setStatus('error');
    }
  }, [inviteToken, authToken]);

  const isPhantomConversion = inviteInfo?.type === 'phantomConversion';

  useEffect(() => {
    // Phantom-conversion links never auto-consume via the logged-in-user flow — there is no
    // logged-in user to consume it, the form below fills in the phantom's own account instead.
    if (authToken && status === 'ready' && !isPhantomConversion) {
      consumeInvite();
    }
  }, [authToken, status, isPhantomConversion, consumeInvite]);

  if (status === 'loading') {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two }}>
        <ActivityIndicator size="large" color={t.color.text} />
        <ThemedText>{Strings.invites.loadingInviteText}</ThemedText>
      </ThemedView>
    );
  }

  if (status === 'invalid' || status === 'error') {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two, padding: Spacing.four }}>
        <ThemedText type="title">{Strings.invites.invalidInviteTitle}</ThemedText>
        {!!errorMessage && <ThemedText style={{ textAlign: 'center' }}>{errorMessage}</ThemedText>}
      </ThemedView>
    );
  }

  if (status === 'joining' || status === 'done') {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two }}>
        <ActivityIndicator size="large" color={t.color.text} />
        <ThemedText>{status === 'done' ? Strings.invites.joinedTeamText : Strings.invites.joiningTeamText}</ThemedText>
      </ThemedView>
    );
  }

  // status === 'ready'
  if (isPhantomConversion) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <PhantomConversionForm
          inviteToken={inviteToken}
          teamName={inviteInfo?.teamName || ''}
          prefill={inviteInfo?.prefill}
        />
      </ThemedView>
    );
  }

  // status === 'ready' && not a phantom conversion && not logged in yet — show the register/login gate.
  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: 'absolute', top: Spacing.six, left: 0, right: 0, alignItems: 'center', zIndex: 1, paddingHorizontal: Spacing.four }}>
        <ThemedText style={{ fontWeight: 'bold', textAlign: 'center' }}>
          {Strings.invites.joinTeamPromptText(inviteInfo?.teamName || '')}
        </ThemedText>
      </View>
      <AuthForm
        initialEmail={inviteInfo?.email || undefined}
      />
    </View>
  );
}
