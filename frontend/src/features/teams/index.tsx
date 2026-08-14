import React from 'react';
import { Platform } from 'react-native';
import { TeamListNative } from './components/team-list-native';

interface TeamListProps {
  teams: any[];
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function TeamList(props: TeamListProps) {
  if (Platform.OS === 'web') {
    const { TeamListWeb } = require('./components/team-list-web');
    return <TeamListWeb {...props} />;
  }
  return <TeamListNative {...props} />;
}

export { CreateTeamForm } from './components/create-team-form';
