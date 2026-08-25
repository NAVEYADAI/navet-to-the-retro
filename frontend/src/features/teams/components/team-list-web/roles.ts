import type { TeamListTheme } from '@/features/teams/types';

export const roles = [
  { label: 'ראש צוות', value: 'TEAM_LEADER' },
  { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER' },
  { label: 'מפתח', value: 'DEVELOPER' },
  { label: 'QA', value: 'TESTER' },
  { label: 'DevOps', value: 'DEVOPS' }
];

export function getRoleLabel(roleVal: string) {
  const found = roles.find(r => r.value === roleVal);
  return found ? found.label : roleVal;
}

export function getRoleStyle(roleVal: string, theme: TeamListTheme) {
  switch (roleVal) {
    case 'TEAM_LEADER':
      return { bg: '#f3e5f5', text: '#7b1fa2' };
    case 'PRODUCT_MANAGER':
      return { bg: '#e3f2fd', text: '#1565c0' };
    case 'DEVELOPER':
      return { bg: '#e8f5e9', text: '#2e7d32' };
    case 'TESTER':
    case 'QA':
      return { bg: '#fff3e0', text: '#e65100' };
    default:
      return { bg: theme.backgroundSelected, text: theme.text };
  }
}
