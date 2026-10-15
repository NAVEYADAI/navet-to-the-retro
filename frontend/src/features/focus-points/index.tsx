import React from 'react';
import { Platform } from 'react-native';
import { SprintFocusPointsSectionNative } from './components/sprint-focus-points-section-native';
import { MyFocusTasksCardNative } from './components/my-focus-tasks-card-native';
import type { useSprintFocusPoints } from './hooks/use-sprint-focus-points';

export { useSprintFocusPoints } from './hooks/use-sprint-focus-points';

/** Retro-board section for a team member: this sprint's points + anonymous rating when the window is open. */
export function SprintFocusPointsSection(props: { focus: ReturnType<typeof useSprintFocusPoints> }) {
  if (Platform.OS === 'web') {
    const { SprintFocusPointsSectionWeb } = require('./components/sprint-focus-points-section-web');
    return <SprintFocusPointsSectionWeb {...props} />;
  }
  return <SprintFocusPointsSectionNative {...props} />;
}

/** Dashboard card: "המשימות שלי" from improvement points. */
export function MyFocusTasksCard(props: { token: string | null | undefined; refreshKey: number }) {
  if (Platform.OS === 'web') {
    const { MyFocusTasksCardWeb } = require('./components/my-focus-tasks-card-web');
    return <MyFocusTasksCardWeb {...props} />;
  }
  return <MyFocusTasksCardNative {...props} />;
}
