import type { IconName } from '@/components/ui';

export interface RoleOption {
  label: string;
  value: string;
  icon: IconName;
}

/** רשימת התפקידים היחידה. משמשת בהרשמה, בהוספת חבר צוות ובעריכת תפקיד. */
export const ROLES: RoleOption[] = [
  { label: 'ראש צוות', value: 'TEAM_LEADER', icon: 'star' },
  { label: 'מנהל מוצר', value: 'PRODUCT_MANAGER', icon: 'target' },
  { label: 'מפתח', value: 'DEVELOPER', icon: 'code' },
  { label: 'QA / בודק', value: 'TESTER', icon: 'shield-check' },
  { label: 'DevOps', value: 'DEVOPS', icon: 'infinity' },
];

export function getRoleLabel(value: string): string {
  return ROLES.find((r) => r.value === value)?.label ?? value;
}
