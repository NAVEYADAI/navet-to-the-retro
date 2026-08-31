import React from 'react';
import { Platform } from 'react-native';
import { AuthFormNative } from './components/auth-form-native';

interface AuthFormProps {
  initialEmail?: string;
}

export function AuthForm(props: AuthFormProps) {
  if (Platform.OS === 'web') {
    const { AuthFormWeb } = require('./components/auth-form-web');
    return <AuthFormWeb {...props} />;
  }
  return <AuthFormNative {...props} />;
}
