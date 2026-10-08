// A 12h JWT can expire mid-session. Without this, an authenticated request that comes back 401
// is swallowed by whichever screen made it and looks like an empty state (BUG-08). The
// interceptor is installed on the global axios instance (most screens call `axios.*` directly)
// and on the shared `apiClient`; AuthProvider supplies the actual "clear the session" handler.

type UnauthorizedHandler = (rejectedToken: string) => void;

let handler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handler = fn;
}

// Failed credentials on these calls are a normal 401/409, not an expired session.
const AUTH_ENTRY_PATH = /\/auth\/(login|register|google)(\/|\?|$)/;

export function isAuthEntryUrl(url: string | undefined | null): boolean {
  return !!url && AUTH_ENTRY_PATH.test(url);
}

function readAuthorizationHeader(headers: any): string | undefined {
  if (!headers) return undefined;
  const value =
    typeof headers.get === 'function'
      ? headers.get('Authorization')
      : headers.Authorization ?? headers.authorization;
  return typeof value === 'string' ? value : undefined;
}

/** Bearer token a failed request was sent with, or null if it was not an authenticated request. */
export function getRejectedToken(error: any): string | null {
  if (error?.response?.status !== 401) return null;
  if (isAuthEntryUrl(error?.config?.url)) return null;
  const header = readAuthorizationHeader(error?.config?.headers);
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** Installs the 401 interceptor on an axios instance. Returns an uninstall function. */
export function installUnauthorizedInterceptor(instance: any): () => void {
  const interceptors = instance?.interceptors?.response;
  if (!interceptors?.use) return () => {};

  const id = interceptors.use(
    (response: any) => response,
    (error: any) => {
      const rejectedToken = getRejectedToken(error);
      if (rejectedToken && handler) handler(rejectedToken);
      return Promise.reject(error);
    },
  );
  return () => interceptors.eject?.(id);
}
