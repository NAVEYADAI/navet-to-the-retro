import { Platform } from 'react-native';
import PostHog from 'posthog-react-native';

// Thin wrapper around the PostHog client so the rest of the app never imports
// `posthog-react-native` directly — makes it safe to call before/without a configured API key
// (local dev with no .env value set), and keeps a single client instance shared between the
// `PostHogProvider` (in _layout.tsx) and calls made outside the React tree (e.g. auth-context).
let client: PostHog | null | undefined;

// PostHog rejects `undefined` property values (its JsonType has no `undefined` member) — this
// is the type callers in this app actually need, restricted to values that are always valid.
export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export function getAnalyticsClient(): PostHog | null {
  if (client !== undefined) return client;

  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    client = null;
    return client;
  }

  client = new PostHog(apiKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
  });
  return client;
}

export function identifyUser(user: { id: string | number; email?: string; username?: string }): void {
  getAnalyticsClient()?.identify(String(user.id), {
    email: user.email ?? null,
    username: user.username ?? null,
  });
}

export function resetAnalytics(): void {
  getAnalyticsClient()?.reset();
}

export function trackEvent(name: string, properties?: AnalyticsProperties): void {
  getAnalyticsClient()?.capture(name, properties);
}

export function captureError(error: unknown, extra?: AnalyticsProperties): void {
  getAnalyticsClient()?.captureException(error, extra);
}

// PostHogErrorBoundary (wired in _layout.tsx) only catches React render errors. Everything else
// (fatal JS errors outside the render tree, unhandled promise rejections) needs to be wired
// manually — posthog-react-native doesn't do this for us on either platform.
if (Platform.OS === 'web') {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      captureError(event.error ?? event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      captureError(event.reason);
    });
  }
} else {
  const globalObj = global as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  };
  const errorUtils = globalObj.ErrorUtils;
  if (errorUtils) {
    const defaultHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      captureError(error, { isFatal: isFatal ?? false });
      defaultHandler(error, isFatal);
    });
  }
}
