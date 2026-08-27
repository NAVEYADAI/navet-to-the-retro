import { Platform } from 'react-native';

export const getBackendUrl = (): string => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
    ? 'https://navet-to-retro-backend.fly.dev'
    : 'http://localhost:5005';
};

// Where invite links should point — always the current origin on web (correct for any port:
// dev, the Playwright e2e stack, or prod), and the known prod URL as a native fallback.
export const getFrontendUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://navet-to-retro-frontend.fly.dev';
};
