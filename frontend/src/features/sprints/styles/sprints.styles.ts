import { StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';

export const sprintsNativeStyles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleFormButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  createForm: {
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.two,
    marginVertical: Spacing.one,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    fontSize: 13,
  },
  datesRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.two,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 12,
    textAlign: 'right',
  },
  sprintsList: {
    gap: Spacing.two,
  },
  sprintCard: {
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.one,
  },
  sprintCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  enterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});
