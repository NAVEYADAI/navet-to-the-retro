import { Slot, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator, Platform, Image } from 'react-native';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AuthForm } from '@/components/auth-form';
import AppTabs from '@/components/navigation/app-tabs';
import { injectGlobalWebStyles } from '@/constants/global-web-styles';
import { AppProviders } from '@/design/app-providers';
import { useTheme } from '@/design/theme-context';

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  injectGlobalWebStyles();
}

function LayoutContent() {
  const { token, loading } = useAuth();
  const pathname = usePathname();
  const isInviteRoute = pathname?.startsWith('/invite/');
  const t = useTheme();

  if (!loading) {
    SplashScreen.hideAsync();
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: t.space[5],
          backgroundColor: t.color.bg,
        }}
      >
        <Image
          source={require('../../assets/images/app-logo.png')}
          style={{ width: 96, height: 96 }}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={t.color.accent.base} />
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

  return <AppTabs />;
}

export default function TabLayout() {
  return (
    <AuthProvider>
      <AppProviders>
        <Head>
          <title>נווט לרט</title>
        </Head>
        <LayoutContent />
      </AppProviders>
    </AuthProvider>
  );
}
