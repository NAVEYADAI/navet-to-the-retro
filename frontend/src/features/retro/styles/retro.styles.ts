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

export const retroNativeStyles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  titleContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  description: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 4,
  },
  postSection: {
    padding: Spacing.four,
    borderRadius: 12,
    gap: Spacing.two,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 12,
    textAlign: 'center',
  },
  wheelWrapper: {
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  yinYangWheel: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  wheelHalf: {
    width: 40,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keepHalf: {
    borderTopLeftRadius: 40,
    borderBottomLeftRadius: 40,
  },
  improveHalf: {
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
  },
  wheelCenter: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    top: 30,
    left: 30,
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  postControls: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  anonymousToggle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.one,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  boardColumns: {
    gap: Spacing.four,
    width: '100%',
  },
  column: {
    flex: 1,
    gap: Spacing.two,
  },
  columnHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    paddingBottom: Spacing.one,
    borderBottomWidth: 2,
  },
  emptyText: {
    textAlign: 'right',
    fontSize: 13,
    opacity: 0.6,
    paddingVertical: Spacing.two,
  },
  commentCard: {
    padding: Spacing.three,
    borderRadius: 8,
    gap: Spacing.one,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  commentMeta: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  authorText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 10,
    opacity: 0.7,
  },
});
