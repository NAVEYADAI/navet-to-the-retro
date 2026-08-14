import { StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';

export const authNativeStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  contentCard: {
    width: '100%',
    maxWidth: 420,
    padding: Spacing.five,
    borderRadius: 12,
    gap: Spacing.three,
    borderWidth: 1,
  },
  logoContainer: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  logoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 13,
    lineHeight: 18,
  },
  formContainer: {
    gap: Spacing.two,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
    textAlign: 'right',
  },
  passwordInputContainer: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    padding: 0,
    textAlign: 'right',
  },
  showPasswordBtn: {
    paddingRight: Spacing.two,
    justifyContent: 'center',
    height: '100%',
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  toggleLink: {
    marginTop: Spacing.one,
    padding: Spacing.one,
  },
  errorBanner: {
    padding: Spacing.two,
    borderRadius: 6,
    borderRightWidth: 4,
    borderRightColor: '#c62828',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'right',
    fontWeight: 'bold',
  },
});
