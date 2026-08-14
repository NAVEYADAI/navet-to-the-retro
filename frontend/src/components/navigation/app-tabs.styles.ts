import { StyleSheet } from 'react-native';
import { MaxContentWidth } from '@/constants/theme';

export const navStyles = StyleSheet.create({
  tabListContainer: {
    position: 'fixed' as any,
    top: 14,
    left: 0,
    right: 0,
    height: 62,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    width: '94%',
    maxWidth: MaxContentWidth + 40,
    marginHorizontal: 'auto' as any,
  },
  innerContainer: {
    width: '100%',
    paddingHorizontal: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  brandTextBlock: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 0,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 20,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    lineHeight: 12,
  },
  navLinks: {
    flexDirection: 'row-reverse',
    gap: 4,
    alignItems: 'center',
  },
  leftActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
});
