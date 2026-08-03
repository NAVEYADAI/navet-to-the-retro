import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AuthForm } from '../auth-form';

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
  it('renders Login fields by default', () => {
    const { getByPlaceholderText, queryByPlaceholderText } = render(<AuthForm />);

    // Login screen should have username and password
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();

    // But should not have email or name fields
    expect(queryByPlaceholderText('Email Address')).toBeNull();
    expect(queryByPlaceholderText('First Name')).toBeNull();
    expect(queryByPlaceholderText('Last Name')).toBeNull();
  });

  it('switches to Sign Up fields when toggle is clicked', () => {
    const { getByText, getByPlaceholderText } = render(<AuthForm />);

    // Click on toggle link
    const toggleLink = getByText("Don't have an account? Sign up here");
    fireEvent.press(toggleLink);

    // Register screen should now show email and name fields
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Email Address')).toBeTruthy();
    expect(getByPlaceholderText('First Name')).toBeTruthy();
    expect(getByPlaceholderText('Last Name')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();

    // The link should toggle back
    expect(getByText('Already have an account? Log in here')).toBeTruthy();
  });
});
