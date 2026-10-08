import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PROD_BACKEND_URL = 'https://navet-to-retro-backend.fly.dev';
const LOCAL_BACKEND_PORT = 5005;

// Hosts that mean "this machine" — localhost (and *.localhost), the IPv4/IPv6 loopback literals.
const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';

// RFC 1918 private ranges — a dev frontend opened from another device on the LAN
// (http://192.168.1.20:8081) must still talk to the dev backend on the same machine.
const isPrivateLanHost = (hostname: string): boolean => {
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

/**
 * Pure resolver for the web backend URL (exported for tests). Production builds always point at the
 * deployed backend. In dev, localhost / 127.0.0.1 / [::1] / LAN IPs map to a local backend on the
 * same host — previously only the literal "localhost" did, so opening the dev server at
 * http://127.0.0.1:8087 silently wrote test data to production (BUG-30).
 */
export const resolveWebBackendUrl = (hostname: string, isDev: boolean): string => {
  if (isLoopbackHost(hostname)) {
    // Keep the historical "localhost" spelling for the common case.
    return `http://${hostname.endsWith('.localhost') || hostname === 'localhost' ? 'localhost' : hostname}:${LOCAL_BACKEND_PORT}`;
  }
  if (isDev && isPrivateLanHost(hostname)) {
    return `http://${hostname}:${LOCAL_BACKEND_PORT}`;
  }
  return PROD_BACKEND_URL;
};

// Hostnames of Expo tunnels — they only forward the Metro port, so they say nothing about where
// the backend lives.
const isTunnelHost = (hostname: string): boolean =>
  hostname.endsWith('.exp.direct') || hostname.endsWith('.ngrok.io') || hostname.endsWith('.ngrok-free.app');

/** Host part of Expo's `hostUri` ("192.168.1.20:8081", optionally with scheme/path), or null. */
export const parseHostUriHost = (hostUri: string | null | undefined): string | null => {
  if (!hostUri) return null;
  const withoutScheme = hostUri.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0];
  // Bracketed IPv6 literal: "[::1]:8081".
  const bracketed = /^(\[[^\]]+\])(?::\d+)?$/.exec(withoutScheme);
  const host = bracketed ? bracketed[1] : withoutScheme.replace(/:\d+$/, '');
  return host || null;
};

/**
 * Pure resolver for the native (iOS/Android) backend URL (exported for tests). In dev the Metro
 * host is the developer's machine, so a real device on the LAN must reach the backend there rather
 * than at its own `localhost` (BUG-30). The Android emulator reaches the host machine through
 * 10.0.2.2. Anything that isn't dev keeps the historical `localhost` default.
 */
export const resolveNativeBackendUrl = (opts: {
  isDev: boolean;
  os: string;
  hostUri?: string | null;
}): string => {
  const fallbackHost = opts.isDev && opts.os === 'android' ? '10.0.2.2' : 'localhost';
  if (!opts.isDev) return `http://localhost:${LOCAL_BACKEND_PORT}`;

  const host = parseHostUriHost(opts.hostUri);
  if (host && !isTunnelHost(host)) {
    if (isLoopbackHost(host)) {
      return `http://${opts.os === 'android' ? '10.0.2.2' : host}:${LOCAL_BACKEND_PORT}`;
    }
    return `http://${host}:${LOCAL_BACKEND_PORT}`;
  }
  return `http://${fallbackHost}:${LOCAL_BACKEND_PORT}`;
};

export const getBackendUrl = (): string => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return resolveWebBackendUrl(window.location.hostname, process.env.NODE_ENV !== 'production');
  }
  return resolveNativeBackendUrl({
    isDev: process.env.NODE_ENV !== 'production',
    os: Platform.OS,
    hostUri: Constants.expoConfig?.hostUri,
  });
};

// Where invite links should point — always the current origin on web (correct for any port:
// dev, the Playwright e2e stack, or prod), and the known prod URL as a native fallback.
export const getFrontendUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://navet-to-retro-frontend.fly.dev';
};
