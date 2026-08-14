import { StyleSheet, Platform } from 'react-native';
import { Spacing } from '@/constants/theme';

export const getShadow = (opacity: number, radius: number, offsetHeight: number) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${offsetHeight}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: offsetHeight },
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
};

export const teamsNativeStyles = StyleSheet.create({
  teamList: {
    gap: Spacing.four,
    width: '100%',
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.three,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: Spacing.two,
  },
  teamName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  officeLocation: {
    opacity: 0.7,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
    textAlign: 'right',
  },
  membersList: {
    gap: Spacing.two,
  },
  memberRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  memberInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.two,
  },
  memberName: {
    fontWeight: '600',
    fontSize: 14,
  },
  memberRole: {
    fontSize: 12,
    opacity: 0.7,
  },
  addMemberBtn: {
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  addMemberForm: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: 8,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
    textAlign: 'right',
  },
  rolePickerContainer: {
    gap: Spacing.one,
  },
  rolesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    height: 42,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  submitBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.two,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    marginVertical: Spacing.one,
  },
  errorText: {
    color: '#c62828',
    fontSize: 13,
    textAlign: 'right',
  },
});
