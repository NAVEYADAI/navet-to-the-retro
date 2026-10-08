import React from 'react';
import { Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/design/theme-context';
import { MaxContentWidth } from '@/constants/theme';
import { SprintRetroBoard } from '@/features/retro';
import { MemoryBoard } from './memory-board';
import { SprintSummary } from '@/features/sprint-summary';
import { goBackOr, openSprint, sprintPath, type SprintView } from '@/lib/sprint-routes';
import { useSprintRouteData } from '../hooks/use-sprint-route-data';
import { SprintRouteStateNative } from './sprint-route-state-native';

/**
 * Body of the three sprint routes (app/(home)/team/[teamId]/sprint/[sprintId]/{index,summary,memory}).
 * Fetches the sprint + team by id on mount (so F5 and shared links work), then renders the
 * requested view. Navigation between the views is real router navigation (BUG-33).
 */
export function SprintRouteScreen({ view }: { view: SprintView }) {
  const t = useTheme();
  const { user, token } = useAuth();
  const { teamId, sprintId } = useLocalSearchParams<{ teamId: string; sprintId: string }>();
  const { status, team, sprint, retry } = useSprintRouteData(teamId, sprintId, token);

  const goToDashboard = () => goBackOr('/');
  // Summary/memory go "back to the board": pop when we came from it, else (F5 / deep link) replace.
  const backToBoard = () => goBackOr(sprintPath(teamId, sprintId));

  let content: React.ReactNode;
  if (status !== 'ready' || !user) {
    // Same lazy-require platform branch as features/retro/index.tsx — keeps MUI out of native bundles.
    const StateView = Platform.OS === 'web' ? require('./sprint-route-state-web').SprintRouteStateWeb : SprintRouteStateNative;
    content = <StateView status={status === 'ready' ? 'loading' : status} onRetry={retry} onBackToDashboard={goToDashboard} />;
  } else if (view === 'summary') {
    content = <SprintSummary sprint={sprint} team={team} token={token || ''} onBack={backToBoard} />;
  } else if (view === 'memory') {
    content = <MemoryBoard sprint={sprint} team={team} token={token || ''} onBack={backToBoard} />;
  } else {
    content = (
      <SprintRetroBoard
        sprint={sprint}
        team={team}
        token={token || ''}
        user={user}
        onBack={goToDashboard}
        onOpenSummary={() => openSprint(team.id, sprint.id, 'summary')}
        onOpenMemory={() => openSprint(team.id, sprint.id, 'memory')}
      />
    );
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
