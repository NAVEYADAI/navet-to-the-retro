import { Platform } from 'react-native';

export const getBackendUrl = (): string => {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
    ? 'https://navet-to-retro-backend.fly.dev'
    : 'http://localhost:5005';
};
