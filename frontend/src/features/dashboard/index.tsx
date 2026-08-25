import React from 'react';
import { Platform } from 'react-native';
import { DashboardNative } from './components/dashboard-native';

export function Dashboard() {
  if (Platform.OS === 'web') {
    const { DashboardWeb } = require('./components/dashboard-web');
    return <DashboardWeb />;
  }
  return <DashboardNative />;
}
