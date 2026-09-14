import React, { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, Platform, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import axios from 'axios';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { getBackendUrl } from '@/api/config';
import { trackEvent } from '@/lib/analytics';
import { Icon } from '@/components/ui';
import { ROLES } from '@/constants/roles';

type Status = 'exchanging' | 'choosingRole' | 'completingRegistration' | 'error';

/**
 * Reached by the browser after the backend's `GET /auth/google/callback` redirect
 * (product-backlog/07-google-sign-in.md §7.0 default #5/#6) — runs *before* there is a `token` in AuthContext, so
 * `_layout.tsx` must bypass its normal auth gate for this route (same technique as
 * `isInviteRoute` for `/invite/[token]`).
 *
 * 2026-09-13 (Nave's request): a brand-new Google identity (no existing account matched) no
 * longer logs straight in with a forced DEVELOPER role — the backend hands back a `pendingTicket`
 * instead of a real `ticket`, and this page shows a role-picker step (parity with the
 * password-registration form) before calling `POST /auth/google/complete-registration` to
 * actually create the account. This is also what makes clicking "Continue with Google" from the
 * LOGIN screen work correctly for someone who isn't registered yet: they land here exactly the
 * same way and simply finish registration, without repeating the Google consent screen.
 */
export default function GoogleLoginCallbackPage() {
  const { ticket, pendingTicket, error } = useLocalSearchParams<{ ticket?: string; pendingTicket?: string; error?: string }>();
  const { login } = useAuth();
  const t = useTheme();

  const [status, setStatus] = useState<Status>('exchanging');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [role, setRole] = useState('DEVELOPER');

  useEffect(() => {
    trackEvent('google_login_callback_viewed', { hasTicket: !!ticket, hasPendingTicket: !!pendingTicket, hasError: !!error });
    // Only meant to run once per mount — params come from the initial query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redirectHome = () => {
    // A client-side router.replace() here crashes expo-router/ui's <Tabs> (it doesn't handle
    // mounting fresh right after a same-session Slot→Tabs transition) — a full reload sidesteps
    // it entirely and is proven to work (see _layout.tsx's auth gate and invite/[token].tsx's
    // identical workaround).
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      router.replace('/');
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (error) {
        if (cancelled) return;
        setErrorMessage(Strings.auth.googleCallbackErrorText);
        setStatus('error');
        trackEvent('google_login_failed', { reason: 'redirect_error' });
        return;
      }

      if (pendingTicket) {
        if (cancelled) return;
        setStatus('choosingRole');
        trackEvent('google_registration_role_step_viewed');
        return;
      }

      if (!ticket) {
        if (cancelled) return;
        setErrorMessage(Strings.auth.googleCallbackErrorText);
        setStatus('error');
        trackEvent('google_login_failed', { reason: 'missing_ticket' });
        return;
      }

      try {
        const response = await axios.post(`${getBackendUrl()}/auth/google/exchange`, { ticket });
        if (cancelled) return;
        await login(response.data.accessToken, response.data.user);
        trackEvent('google_login_succeeded');
        redirectHome();
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err.response?.data?.message || Strings.auth.googleCallbackErrorText);
        setStatus('error');
        trackEvent('google_login_failed', { reason: 'exchange_failed' });
      }
    })();

    return () => { cancelled = true; };
  }, [ticket, pendingTicket, error, login]);

  const handleCompleteRegistration = async () => {
    trackEvent('google_registration_role_selected', { role });
    setStatus('completingRegistration');
    try {
      const response = await axios.post(`${getBackendUrl()}/auth/google/complete-registration`, { pendingTicket, role });
      await login(response.data.accessToken, response.data.user);
      trackEvent('google_registration_completed');
      redirectHome();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || Strings.auth.googleCallbackErrorText);
      setStatus('error');
      trackEvent('google_login_failed', { reason: 'complete_registration_failed' });
    }
  };

  const goBackToAuth = () => {
    trackEvent('google_login_callback_back_clicked');
    redirectHome();
  };

  if (status === 'error') {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two, padding: Spacing.four }}>
        <ThemedText type="title">{Strings.auth.googleCallbackErrorTitle}</ThemedText>
        {!!errorMessage && <ThemedText style={{ textAlign: 'center' }}>{errorMessage}</ThemedText>}
        <TouchableOpacity
          onPress={goBackToAuth}
          style={{
            marginTop: Spacing.two,
            height: t.layout.minTouchTarget,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: Spacing.four,
            borderRadius: t.radius.field,
            backgroundColor: t.color.accent.base,
          }}
        >
          <ThemedText style={{ color: t.color.accent.onBase, fontWeight: '700' }}>
            {Strings.auth.googleCallbackBackButton}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (status === 'choosingRole' || status === 'completingRegistration') {
    const isSubmitting = status === 'completingRegistration';
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.four, padding: Spacing.four }}>
        <View style={{ width: '100%', maxWidth: 420, gap: Spacing.four }}>
          <View style={{ alignItems: 'center', gap: Spacing.one }}>
            <ThemedText type="title">{Strings.auth.googleChooseRoleTitle}</ThemedText>
            <ThemedText style={{ textAlign: 'center' }}>{Strings.auth.googleChooseRoleSubtitle}</ThemedText>
          </View>

          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' }}>
            {ROLES.map((r) => {
              const isSelected = role === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setRole(r.value)}
                  disabled={isSubmitting}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: Spacing.half + 2,
                    borderRadius: t.radius.pill,
                    borderWidth: 1.5,
                    borderColor: isSelected ? t.color.accent.base : t.color.border,
                    backgroundColor: isSelected ? t.color.accent.subtle : t.color.surface,
                    paddingHorizontal: Spacing.three,
                    paddingVertical: Spacing.one + 3,
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  <Icon name={r.icon} size="sm" tone={isSelected ? 'accent' : 'muted'} />
                  <ThemedText style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? t.color.accent.base : t.color.textSecondary }}>
                    {r.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handleCompleteRegistration}
            disabled={isSubmitting}
            style={{
              height: t.layout.minTouchTarget,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: t.radius.field,
              backgroundColor: t.color.accent.base,
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={t.color.accent.onBase} />
            ) : (
              <ThemedText style={{ color: t.color.accent.onBase, fontWeight: '700' }}>
                {Strings.auth.googleChooseRoleButton}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two }}>
      <ActivityIndicator size="large" color={t.color.text} />
      <ThemedText>{Strings.auth.googleCallbackLoadingText}</ThemedText>
    </ThemedView>
  );
}
