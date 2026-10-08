/** "שם פרטי שם משפחה", או @username כשאין שם — אותו פורמט בכרטיס הצוות ובשורת החבר. */
export function memberDisplayName(member: any): string {
  const first = member.user?.firstName || '';
  const last = member.user?.lastName || '';
  return first || last ? `${first} ${last}`.trim() : `@${member.user?.username || ''}`;
}
