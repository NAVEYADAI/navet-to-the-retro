import { StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';

export const nativeStyles = StyleSheet.create({
  teamsList: { gap: Spacing.four },
  sectionHeader: { fontSize: 20, fontWeight: 'bold', marginVertical: Spacing.one },
  infoSection: { padding: Spacing.three, borderRadius: 10, gap: Spacing.three },
  teamHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  roleBadge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: 12 },
  roleText: { fontSize: 12, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row-reverse', gap: Spacing.one },
  membersContainer: { gap: Spacing.one, marginTop: Spacing.one },
  memberListItem: { paddingVertical: Spacing.one },
  memberRowContent: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  editMemberPane: { padding: Spacing.two, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.02)', gap: Spacing.one },
  roleOptionBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  actionSaveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  actionCancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  addMemberSection: { gap: Spacing.two, marginTop: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  input: { height: 42, borderWidth: 1, borderRadius: 6, paddingHorizontal: Spacing.two, fontSize: 14, textAlign: 'right' },
  button: { height: 42, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.one },
  buttonText: { fontSize: 14, fontWeight: 'bold' },
  errorBannerInline: { backgroundColor: '#ffebee', padding: 6, borderRadius: 4, borderWidth: 1, borderColor: '#ffcdd2' },
  errorTextInline: { color: '#c62828', fontSize: 12, textAlign: 'right' },
});
