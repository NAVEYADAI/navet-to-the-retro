export const roles = [
  { label: 'מפתח', value: 'DEVELOPER' },
  { label: 'QA', value: 'TESTER' },
  { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER' },
  { label: 'מוביל צוות', value: 'TEAM_LEADER' },
  { label: 'DevOps', value: 'DEVOPS' }
];

export function getRoleLabel(roleVal: string) {
  const found = roles.find(r => r.value === roleVal);
  return found ? found.label : roleVal;
}
