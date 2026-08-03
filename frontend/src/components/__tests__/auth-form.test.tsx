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
  it('renders Login fields by default', async () => {
    const { getByPlaceholderText, queryByPlaceholderText } = await render(<AuthForm />);

    // Login screen should have username and password
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();

    // But should not have email or name fields
    expect(queryByPlaceholderText('Email Address')).toBeNull();
    expect(queryByPlaceholderText('First Name')).toBeNull();
    expect(queryByPlaceholderText('Last Name')).toBeNull();
  });

  it('switches to Sign Up fields when toggle is clicked', async () => {
    const { getByText, findByPlaceholderText, findByText } = await render(<AuthForm />);

    // Click on toggle link
    const toggleLink = getByText("Don't have an account? Sign up here");
    fireEvent.press(toggleLink);

    // Use findBy queries to wait for state transition and re-rendering to complete
    expect(await findByPlaceholderText('Username')).toBeTruthy();
    expect(await findByPlaceholderText('Email Address')).toBeTruthy();
    expect(await findByPlaceholderText('First Name')).toBeTruthy();
    expect(await findByPlaceholderText('Last Name')).toBeTruthy();
    expect(await findByPlaceholderText('Password')).toBeTruthy();

    // The link should toggle back
    expect(await findByText('Already have an account? Log in here')).toBeTruthy();
  });
});
