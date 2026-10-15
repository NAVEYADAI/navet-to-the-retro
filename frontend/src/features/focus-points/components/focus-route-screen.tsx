import React from 'react';
import { Platform, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { TeamAccentScope, useTheme } from '@/design/theme-context';
import { MaxContentWidth } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { goBackOr } from '@/lib/sprint-routes';
import { useTeamFocusRoute } from '../hooks/use-team-focus-route';
import { FocusPointsAdminNative } from './focus-points-admin-native';
import { rnText } from './native-parts';

/** Body of /team/:teamId/focus-points — loads the team (cold entry works), then the management screen. */
export function FocusRouteScreen() {
  const t = useTheme();
  const { token } = useAuth();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { status, team, retry } = useTeamFocusRoute(teamId, token);
  const goBack = () => goBackOr('/');

  let content: React.ReactNode;
  if (status !== 'ready' || !team) {
    if (Platform.OS === 'web') {
      const { FocusRouteStateWeb } = require('./focus-route-state-web');
      content = <FocusRouteStateWeb status={status === 'ready' ? 'loading' : status} onRetry={retry} onBack={goBack} />;
    } else {
      content = (
        <View style={{ padding: t.space[6], alignItems: 'center', gap: t.space[3] }}>
          {status === 'loading' ? <ActivityIndicator size="large" color={t.color.text} /> : null}
          <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'center' }]}>
            {status === 'loading' ? Strings.focusPoints.loading : status === 'notFound' ? Strings.focusPoints.routeNotFound : Strings.focusPoints.loadError}
          </Text>
          {status === 'error' ? (
            <TouchableOpacity onPress={retry}><Text style={[rnText(t.type.label), { color: t.color.accent.base }]}>{Strings.sprintRoute.retryButton}</Text></TouchableOpacity>
          ) : null}
        </View>
      );
    }
  } else if (Platform.OS === 'web') {
    const { FocusPointsAdminWeb } = require('./focus-points-admin-web');
    content = <FocusPointsAdminWeb team={team} token={token || ''} onBack={goBack} />;
  } else {
    content = <FocusPointsAdminNative team={team} token={token || ''} onBack={goBack} />;
  }

  if (status === 'ready' && team) {
    content = <TeamAccentScope hue={team.accentHue}>{content}</TeamAccentScope>;
  }
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1, minHeight: '100vh' as any, backgroundColor: t.color.bg }}>{content}</View>;
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', flexDirection: 'row', backgroundColor: t.color.bg }}>
      <SafeAreaView style={{ flex: 1, maxWidth: MaxContentWidth, width: '100%' }}>{content}</SafeAreaView>
    </View>
  );
}
