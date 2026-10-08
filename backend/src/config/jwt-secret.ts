// BUG-43: single source of truth for the JWT signing secret. There is deliberately NO hard-coded
// fallback for real environments — a missing JWT_SECRET makes the process fail at startup
// (every service reads this in a constructor-time field initializer, so Nest's bootstrap throws)
// instead of silently signing tokens with a publicly-known key. Only NODE_ENV === 'test' (Jest
// unit + e2e) gets a fixed test secret so those suites don't need the env var exported.
export const TEST_JWT_SECRET = 'test-jwt-secret';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'test') {
    return TEST_JWT_SECRET;
  }
  throw new Error('JWT_SECRET environment variable is required but not set');
}
