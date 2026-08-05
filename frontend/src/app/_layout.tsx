import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, ActivityIndicator, Platform } from 'react-native';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AuthForm } from '@/components/auth-form';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

// Inject global CSS keyframes + font import for web animations (runs once at startup)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; }
    body {
      font-family: 'Rubik', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    ::selection { background: rgba(99,102,241,0.25); }

    @keyframes navSlideIn {
      from { opacity: 0; transform: translateY(-20px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.94); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes pulse {
      0%   { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(99,102,241,0.6); }
      70%  { transform: scale(1);    box-shadow: 0 0 0 10px rgba(99,102,241,0); }
      100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(99,102,241,0); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50%      { transform: translateY(-6px); }
    }
    @keyframes gradientShift {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* Global smooth scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: rgba(99,102,241,0.2);
      border-radius: 999px;
    }
    ::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.35); }
  `;
  document.head.appendChild(style);
}

function LayoutContent() {
  const { token, loading } = useAuth();
  const colorScheme = useColorScheme();

  // Hide splash screen when session loading completes
  if (!loading) {
    SplashScreen.hideAsync();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#0a0a0f' : '#fafbff' }}>
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#818cf8' : '#6366f1'} />
      </View>
    );
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
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LayoutContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
