import { getJwtSecret, TEST_JWT_SECRET } from './jwt-secret';

describe('getJwtSecret (BUG-43)', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('returns JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'real-secret';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(getJwtSecret()).toBe('real-secret');
  });

  it('throws when JWT_SECRET is missing outside of NODE_ENV=test', () => {
    delete process.env.JWT_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
    (process.env as Record<string, string | undefined>).NODE_ENV = undefined;
    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });

  it('falls back to the fixed test secret only when NODE_ENV=test', () => {
    delete process.env.JWT_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    expect(getJwtSecret()).toBe(TEST_JWT_SECRET);
  });
});
