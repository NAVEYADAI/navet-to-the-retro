export { getRoleLabel } from '@/constants/roles';

const roleRank: Record<string, number> = {
  PRODUCT_MANAGER: 2,
  DEVELOPER: 3,
  DEVOPS: 4,
  TESTER: 5,
};

/** Member list order: me, then admins, then product manager / developer / devops / QA. */
export function getMemberRank(member: any, userId: number) {
  if (member.userId === userId) return 0;
  if (member.isAdmin) return 1;
  return roleRank[member.role] ?? 6;
}
