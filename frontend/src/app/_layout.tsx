import { DarkTheme, DefaultTheme, ThemeProvider, Slot, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, ActivityIndicator, Platform, Image } from 'react-native';
import { useEffect, type ComponentType, type PropsWithChildren } from 'react';
import { PostHogProvider, PostHogErrorBoundary as RawPostHogErrorBoundary, type PostHogErrorBoundaryProps } from 'posthog-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// posthog-react-native's class component ships typed against a React version whose `Component`
// shape TS 6 sees as structurally incompatible with this project's React 19 types (missing
// props/state/setState/forceUpdate) — a types-only mismatch, not a runtime one. Cast once here.
const PostHogErrorBoundary = RawPostHogErrorBoundary as unknown as ComponentType<PropsWithChildren<PostHogErrorBoundaryProps>>;
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AuthForm } from '@/components/auth-form';
import { AppCrashFallback } from '@/components/app-crash-fallback';
import AppTabs from '@/components/navigation/app-tabs';
import { injectGlobalWebStyles } from '@/constants/global-web-styles';
import { AppProviders } from '@/design/app-providers';
import { useTheme } from '@/design/theme-context';
import { getAnalyticsClient, trackEvent } from '@/lib/analytics';

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  injectGlobalWebStyles();
}

function LayoutContent() {
  const { token, loading } = useAuth();
  const t = useTheme();
  const pathname = usePathname();
  const isInviteRoute = pathname?.startsWith('/invite/');
  // /auth/google/callback runs before there's a `token` in context (it's the page that produces
  // one, via POST /auth/google/exchange) — same bypass reasoning as isInviteRoute above.
  const isGoogleCallbackRoute = pathname?.startsWith('/auth/google/callback');

  useEffect(() => {
    if (pathname) {
      trackEvent('$pageview', { path: pathname });
    }
  }, [pathname]);

  // Hide splash screen when session loading completes
  if (!loading) {
    SplashScreen.hideAsync();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, backgroundColor: t.color.bg }}>
        <Image source={require('../../assets/images/app-logo.png')} style={{ width: 96, height: 96 }} resizeMode="contain" />
        <ActivityIndicator size="large" color={t.color.accent.base} />
      </View>
    );
  }

  // /invite/[token] must stay reachable through this whole flow — before login (it renders its
  // own AuthForm) and for the moment right after (it still needs to call the consume endpoint
  // and redirect itself). AppTabs' <Tabs> crashes if mounted on a route it has no trigger for,
  // so keep bypassing it here until the page navigates itself away from /invite/*.
  if (isInviteRoute || isGoogleCallbackRoute) {
    return <Slot />;
  }

  // Auth Gate: No navbar rendered if not logged in
  if (!token) {
    return <AuthForm />;
  }

  // Render main tab layout when logged in
  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const content = (
    // Required root wrapper for react-native-gesture-handler's Gesture API (used by the memory
    // board's card double-tap/single-tap detection, memory-card-native.tsx) — without it,
    // GestureDetector is unreliable on native, especially Android.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppProviders>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Head>
              <title>נווט לרט</title>
            </Head>
            <PostHogErrorBoundary fallback={AppCrashFallback}>
              <LayoutContent />
            </PostHogErrorBoundary>
          </ThemeProvider>
        </AppProviders>
      </AuthProvider>
    </GestureHandlerRootView>
  );

  const analyticsClient = getAnalyticsClient();
  if (!analyticsClient) {
    // No EXPO_PUBLIC_POSTHOG_KEY configured (e.g. local dev without it set) — skip the provider
    // entirely rather than let it spin up a client with an empty key.
    return content;
  }

  return (
    <PostHogProvider client={analyticsClient} autocapture={{ captureScreens: false }}>
      {content}
    </PostHogProvider>
  );
}
