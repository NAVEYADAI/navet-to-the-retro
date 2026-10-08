import React from 'react';
import { Platform } from 'react-native';
import { SprintRetroBoardNative } from './components/sprint-retro-board-native';

interface SprintRetroBoardProps {
  sprint: any;
  team: any;
  token: string;
  user: any;
  onBack: () => void;
  onOpenSummary: () => void;
  onOpenMemory: () => void;
}

export function SprintRetroBoard(props: SprintRetroBoardProps) {
  if (Platform.OS === 'web') {
    const { SprintRetroBoardWeb } = require('./components/sprint-retro-board-web');
    return <SprintRetroBoardWeb {...props} />;
  }
  return <SprintRetroBoardNative {...props} />;
}
