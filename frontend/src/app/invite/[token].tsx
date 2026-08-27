import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import axios from 'axios';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthForm } from '@/components/auth-form';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';
import { getBackendUrl } from '@/api/config';

type Status = 'loading' | 'invalid' | 'ready' | 'joining' | 'done' | 'error';

export default function InvitePage() {
  const { token: inviteToken } = useLocalSearchParams<{ token: string }>();
  const { token: authToken } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const isDark = colorScheme === 'dark';

  const [status, setStatus] = useState<Status>('loading');
  const [inviteInfo, setInviteInfo] = useState<{ teamName: string; email: string | null } | null>(null);
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
          setInviteInfo({ teamName: response.data.teamName, email: response.data.email });
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

  useEffect(() => {
    if (authToken && status === 'ready') {
      consumeInvite();
    }
  }, [authToken, status, consumeInvite]);

  if (status === 'loading') {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two }}>
        <ActivityIndicator size="large" color={theme.text} />
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
        <ActivityIndicator size="large" color={theme.text} />
        <ThemedText>{status === 'done' ? Strings.invites.joinedTeamText : Strings.invites.joiningTeamText}</ThemedText>
      </ThemedView>
    );
  }

  // status === 'ready' && not logged in yet — show the register/login gate.
  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: 'absolute', top: Spacing.six, left: 0, right: 0, alignItems: 'center', zIndex: 1, paddingHorizontal: Spacing.four }}>
        <ThemedText style={{ fontWeight: 'bold', textAlign: 'center' }}>
          {Strings.invites.joinTeamPromptText(inviteInfo?.teamName || '')}
        </ThemedText>
      </View>
      <AuthForm
        isDark={isDark}
        theme={theme}
        colorScheme={colorScheme === 'unspecified' ? 'light' : colorScheme}
        initialEmail={inviteInfo?.email || undefined}
      />
    </View>
  );
}
