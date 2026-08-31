import React from 'react';
import { Platform } from 'react-native';
import { SprintRetroBoardNative } from './components/sprint-retro-board-native';

interface SprintRetroBoardProps {
  sprint: any;
  team: any;
  token: string;
  user: any;
  onBack: () => void;
  // Optional: <SprintRetroBoardNative> hasn't been converted off the legacy
  // theme-shaped prop everywhere it's called from yet. Web no longer reads it.
  theme?: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function SprintRetroBoard(props: SprintRetroBoardProps) {
  if (Platform.OS === 'web') {
    const { SprintRetroBoardWeb } = require('./components/sprint-retro-board-web');
    return <SprintRetroBoardWeb {...props} />;
  }
  return <SprintRetroBoardNative {...props} />;
}
