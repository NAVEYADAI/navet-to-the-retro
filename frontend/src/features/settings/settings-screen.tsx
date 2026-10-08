import React from 'react';
import { Platform } from 'react-native';
import { SettingsScreenNative } from './components/settings-screen-native';

/**
 * Platform switch for the /settings route. The web screen is MUI-based and is only `require`d on
 * web (same pattern as `features/dashboard`), so native never evaluates it (BUG-09).
 */
export function SettingsScreen() {
  if (Platform.OS === 'web') {
    const { SettingsScreenWeb } = require('./components/settings-screen-web');
    return <SettingsScreenWeb />;
  }
  return <SettingsScreenNative />;
}
