import React from 'react';
import { Platform } from 'react-native';
import { SprintSummaryNative } from './components/sprint-summary-native';

interface SprintSummaryProps {
  sprint: any;
  team: any;
  token: string;
  onBack: () => void;
}

export function SprintSummary(props: SprintSummaryProps) {
  if (Platform.OS === 'web') {
    const { SprintSummaryWeb } = require('./components/sprint-summary-web');
    return <SprintSummaryWeb {...props} />;
  }
  return <SprintSummaryNative {...props} />;
}
