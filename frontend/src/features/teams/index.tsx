import React from 'react';
import { Platform } from 'react-native';
import { TeamListNative } from './components/team-list-native';

interface TeamListProps {
  teams: any[];
  token: string;
  userId: number;
  onAddMemberSuccess: () => void;
  onSelectSprint: (sprint: any, team: any) => void;
  /** נקרא אחרי שכל כרטיס טוען את הספרינטים שלו — לשורת הסיכום בראש העמוד. */
  onActiveSprintCount?: (teamId: number, count: number) => void;
}

export function TeamList(props: TeamListProps) {
  if (Platform.OS === 'web') {
    const { TeamListWeb } = require('./components/team-list-web');
    return <TeamListWeb {...props} />;
  }
  return <TeamListNative {...props} />;
}

export { CreateTeamForm } from './components/create-team-form';
