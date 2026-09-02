import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '@/design/theme-context';
import { Strings } from '@/constants/strings';

// Rendered by PostHogErrorBoundary (see _layout.tsx) when a React render error escapes the app.
// Uses plain RN primitives (not `@/components/ui`, which is web-only today) so it renders
// correctly on both web (via react-native-web) and native.
export function AppCrashFallback() {
  const t = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: t.space[4],
        padding: t.space[6],
        backgroundColor: t.color.bg,
      }}
    >
      <Text style={{ ...t.type.cardTitle, color: t.color.text, textAlign: 'center' }}>
        {Strings.errors.appCrashTitle}
      </Text>
      <Text style={{ ...t.type.body, color: t.color.textSecondary, textAlign: 'center' }}>
        {Strings.errors.appCrashMessage}
      </Text>
      {Platform.OS === 'web' ? (
        <TouchableOpacity
          onPress={() => window.location.reload()}
          style={{
            backgroundColor: t.color.accent.base,
            paddingHorizontal: t.space[5],
            paddingVertical: t.space[3],
            borderRadius: t.radius.field,
          }}
        >
          <Text style={{ ...t.type.label, fontWeight: 700, color: t.color.accent.onBase }}>
            {Strings.errors.reloadButton}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
