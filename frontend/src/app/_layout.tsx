import { DarkTheme, DefaultTheme, ThemeProvider, Slot, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, ActivityIndicator, Platform, Image } from 'react-native';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AuthForm } from '@/components/auth-form';
import AppTabs from '@/components/navigation/app-tabs';
import { injectGlobalWebStyles } from '@/constants/global-web-styles';
import { AppProviders } from '@/design/app-providers';

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  injectGlobalWebStyles();
}

function LayoutContent() {
  const { token, loading } = useAuth();
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const isInviteRoute = pathname?.startsWith('/invite/');

  // Hide splash screen when session loading completes
  if (!loading) {
    SplashScreen.hideAsync();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, backgroundColor: colorScheme === 'dark' ? '#0a0a0f' : '#fafbff' }}>
        <Image source={require('../../assets/images/app-logo.png')} style={{ width: 96, height: 96 }} resizeMode="contain" />
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#818cf8' : '#6366f1'} />
      </View>
    );
  }

  // /invite/[token] must stay reachable through this whole flow — before login (it renders its
  // own AuthForm) and for the moment right after (it still needs to call the consume endpoint
  // and redirect itself). AppTabs' <Tabs> crashes if mounted on a route it has no trigger for,
  // so keep bypassing it here until the page navigates itself away from /invite/*.
  if (isInviteRoute) {
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

  return (
    <AuthProvider>
      <AppProviders>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Head>
            <title>נווט לרט</title>
          </Head>
          <LayoutContent />
        </ThemeProvider>
      </AppProviders>
    </AuthProvider>
  );
}
