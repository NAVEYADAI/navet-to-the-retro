import React from 'react';
import { Platform } from 'react-native';
import { TeamSprintsManagerNative } from './components/sprint-list-native';

interface TeamSprintsManagerProps {
  team: any;
  token: string;
  isAdmin: boolean;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
  onSelectSprint: (sprint: any, team: any) => void;
}

export function TeamSprintsManager(props: TeamSprintsManagerProps) {
  if (Platform.OS === 'web') {
    const { TeamSprintsManagerWeb } = require('./components/sprint-list-web');
    return <TeamSprintsManagerWeb {...props} />;
  }
  return <TeamSprintsManagerNative {...props} />;
}
