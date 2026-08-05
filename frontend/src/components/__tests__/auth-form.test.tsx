import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AuthForm } from '../auth-form';
import { Strings } from '../../constants/strings';

// Mock Animated.timing to execute callback synchronously in Jest
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Animated.timing = (value: any, config: any) => ({
    start: (callback?: () => void) => {
      if (callback) callback();
    },
  });
  return RN;
});

// Mock the useAuth hook
const mockLogin = jest.fn();
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

// Mock the useColorScheme hook
jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

describe('AuthForm Component', () => {
  it('renders Login fields by default', async () => {
    const { getByPlaceholderText, queryByPlaceholderText } = await render(<AuthForm />);

    // Login screen should have username and password
    expect(getByPlaceholderText(Strings.auth.usernamePlaceholder)).toBeTruthy();
    expect(getByPlaceholderText(Strings.auth.passwordPlaceholder)).toBeTruthy();

    // But should not have email or name fields
    expect(queryByPlaceholderText(Strings.auth.emailPlaceholder)).toBeNull();
    expect(queryByPlaceholderText(Strings.auth.firstNamePlaceholder)).toBeNull();
    expect(queryByPlaceholderText(Strings.auth.lastNamePlaceholder)).toBeNull();
  });

  it('switches to Sign Up fields when toggle is clicked', async () => {
    const { getByText, findByPlaceholderText, findByText } = await render(<AuthForm />);

    // Click on toggle link
    const toggleLink = getByText(Strings.auth.toggleToSignUp);
    fireEvent.press(toggleLink);

    // Use findBy queries to wait for state transition and re-rendering to complete
    expect(await findByPlaceholderText(Strings.auth.usernamePlaceholder)).toBeTruthy();
    expect(await findByPlaceholderText(Strings.auth.emailPlaceholder)).toBeTruthy();
    expect(await findByPlaceholderText(Strings.auth.firstNamePlaceholder)).toBeTruthy();
    expect(await findByPlaceholderText(Strings.auth.lastNamePlaceholder)).toBeTruthy();
    expect(await findByPlaceholderText(Strings.auth.passwordPlaceholder)).toBeTruthy();

    // The link should toggle back
    expect(await findByText(Strings.auth.toggleToLogin)).toBeTruthy();
  });
});
