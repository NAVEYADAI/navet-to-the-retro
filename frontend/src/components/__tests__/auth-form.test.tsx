import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
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

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthForm Component', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders Login fields by default', async () => {
    const { getByPlaceholderText, queryByPlaceholderText } = await render(
      <AuthForm />
    );

    // Login screen should have username and password
    expect(getByPlaceholderText(Strings.auth.usernamePlaceholder)).toBeTruthy();
    expect(getByPlaceholderText(Strings.auth.passwordPlaceholder)).toBeTruthy();

    // But should not have name fields
    expect(queryByPlaceholderText(Strings.auth.firstNamePlaceholder)).toBeNull();
    expect(queryByPlaceholderText(Strings.auth.lastNamePlaceholder)).toBeNull();
  });

  it('switches to Sign Up fields when toggle is clicked', async () => {
    const { getByText, findByPlaceholderText, findByText } = await render(
      <AuthForm />
    );

    // Click on toggle link
    const toggleLink = getByText(Strings.auth.toggleToSignUp);
    await fireEvent.press(toggleLink);

    // Use findBy queries to wait for state transition and re-rendering to complete
    expect(await findByPlaceholderText(Strings.auth.emailPlaceholder)).toBeTruthy();
    expect(await findByPlaceholderText(Strings.auth.firstNamePlaceholder)).toBeTruthy();
    expect(await findByPlaceholderText(Strings.auth.lastNamePlaceholder)).toBeTruthy();
    expect(await findByPlaceholderText(Strings.auth.passwordPlaceholder)).toBeTruthy();

    // Verify role selection elements exist
    expect(await findByText(/תפקיד מקצועי/)).toBeTruthy();
    expect(await findByText("מפתח")).toBeTruthy();

    // The link should toggle back
    expect(await findByText(Strings.auth.toggleToLogin)).toBeTruthy();
  });

  describe('Login submit flow', () => {
    it('blocks submit and shows an error when required fields are missing', async () => {
      const { getByText, findByText } = await render(<AuthForm />);

      await fireEvent.press(getByText(Strings.auth.loginButton));

      expect(await findByText(Strings.auth.requiredFieldsError)).toBeTruthy();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('logs in successfully: posts credentials and calls login() with the response', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { accessToken: 'token-abc', user: { id: 1, username: 'nave' } },
      });

      const { getByPlaceholderText, getByText } = await render(
        <AuthForm />
      );

      const usernameInput = getByPlaceholderText(Strings.auth.usernamePlaceholder);
      const passwordInput = getByPlaceholderText(Strings.auth.passwordPlaceholder);

      await fireEvent.changeText(usernameInput, 'nave');
      await fireEvent.changeText(passwordInput, 'secret123');

      await fireEvent.press(getByText(Strings.auth.loginButton));

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        { username: 'nave', password: 'secret123' }
      );
      expect(mockLogin).toHaveBeenCalledWith('token-abc', { id: 1, username: 'nave' });
    });

    it('shows the server error and does not call login() when login fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(
        Object.assign(new Error('Unauthorized'), {
          response: { data: { message: 'שם משתמש או סיסמה שגויים' } },
        })
      );

      const { getByPlaceholderText, getByText, findByText } = await render(
        <AuthForm />
      );

      await fireEvent.changeText(getByPlaceholderText(Strings.auth.usernamePlaceholder), 'nave');
      await fireEvent.changeText(getByPlaceholderText(Strings.auth.passwordPlaceholder), 'wrong');

      await fireEvent.press(getByText(Strings.auth.loginButton));

      expect(await findByText('שם משתמש או סיסמה שגויים')).toBeTruthy();
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Register submit flow', () => {
    async function renderInSignUpMode() {
      const utils = await render(<AuthForm />);
      await fireEvent.press(utils.getByText(Strings.auth.toggleToSignUp));
      await utils.findByPlaceholderText(Strings.auth.emailPlaceholder);
      return utils;
    }

    it('blocks submit and shows an error when required fields are missing', async () => {
      const { getByText, findByText } = await renderInSignUpMode();

      await fireEvent.press(getByText(Strings.auth.signUpButton));

      expect(await findByText(Strings.auth.requiredFieldsError)).toBeTruthy();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('registers successfully: posts the full payload and calls login() with the response', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { accessToken: 'token-xyz', user: { id: 2, email: 'new@example.com' } },
      });

      const { getByPlaceholderText, getByText } = await renderInSignUpMode();

      const emailInput = getByPlaceholderText(Strings.auth.emailPlaceholder);
      const firstNameInput = getByPlaceholderText(Strings.auth.firstNamePlaceholder);
      const lastNameInput = getByPlaceholderText(Strings.auth.lastNamePlaceholder);
      const passwordInput = getByPlaceholderText(Strings.auth.passwordPlaceholder);

      await fireEvent.changeText(emailInput, 'new@example.com');
      await fireEvent.changeText(firstNameInput, 'Dana');
      await fireEvent.changeText(lastNameInput, 'Cohen');
      await fireEvent.changeText(passwordInput, 'secret123');

      await fireEvent.press(getByText(Strings.auth.signUpButton));

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        {
          username: 'new@example.com',
          email: 'new@example.com',
          password: 'secret123',
          firstName: 'Dana',
          lastName: 'Cohen',
          role: 'DEVELOPER',
        }
      );
      expect(mockLogin).toHaveBeenCalledWith('token-xyz', { id: 2, email: 'new@example.com' });
    });

    it('shows the server error and does not call login() when registration fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(
        Object.assign(new Error('Conflict'), {
          response: { data: { message: 'כתובת האימייל כבר קיימת במערכת' } },
        })
      );

      const { getByPlaceholderText, getByText, findByText } = await renderInSignUpMode();

      await fireEvent.changeText(getByPlaceholderText(Strings.auth.emailPlaceholder), 'dup@example.com');
      await fireEvent.changeText(getByPlaceholderText(Strings.auth.passwordPlaceholder), 'secret123');

      await fireEvent.press(getByText(Strings.auth.signUpButton));

      expect(await findByText('כתובת האימייל כבר קיימת במערכת')).toBeTruthy();
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });
});
