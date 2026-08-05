import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, ActivityIndicator, Platform } from 'react-native';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AuthForm } from '@/components/auth-form';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

// Inject global CSS keyframes for web animations (runs once at startup)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    body { font-family: 'Rubik', -apple-system, BlinkMacSystemFont, sans-serif; }
    @keyframes navSlideIn {
      from { opacity: 0; transform: translateY(-16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%   { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.7); }
      70%  { transform: scale(1);    box-shadow: 0 0 0 8px rgba(46, 125, 50, 0); }
      100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
    }
    /* Smooth page transitions */
    .tab-slot-content { animation: fadeInUp 0.35s ease both; }
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }}>
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#fff' : '#000'} />
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
