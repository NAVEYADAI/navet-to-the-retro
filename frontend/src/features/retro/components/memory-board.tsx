import React from 'react';
import { Platform } from 'react-native';
import { MemoryBoardNative } from './memory-board-native';

interface MemoryBoardProps {
  sprint: any;
  team: any;
  token: string;
  onBack: () => void;
}

/** Same platform-branch pattern as `SprintRetroBoard` (features/retro/index.tsx). */
export function MemoryBoard(props: MemoryBoardProps) {
  if (Platform.OS === 'web') {
    const { MemoryBoardWeb } = require('./memory-board-web');
    return <MemoryBoardWeb {...props} />;
  }
  return <MemoryBoardNative {...props} />;
}
