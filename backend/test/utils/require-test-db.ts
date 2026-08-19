import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

function readEnvFile(filename: string): Record<string, string> {
  const filePath = path.join(BACKEND_ROOT, filename);
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath));
}

/**
 * Refuses to proceed unless process.env.DATABASE_URL is exactly the value
 * declared in backend/.env.test and differs from backend/.env — so a missing
 * or misconfigured .env.test can never let e2e cleanup run against dev/prod.
 */
export function assertTestDatabase(): void {
  const runtimeUrl = process.env.DATABASE_URL;
  const devEnv = readEnvFile('.env');
  const testEnv = readEnvFile('.env.test');

  if (!runtimeUrl) {
    throw new Error(
      'DATABASE_URL is not set. Run e2e tests via `npm run test:e2e`, which loads backend/.env.test through dotenv-cli.'
    );
  }
  if (!testEnv.DATABASE_URL) {
    throw new Error(
      'backend/.env.test is missing (or has no DATABASE_URL). Create it from backend/.env.test.example, pointing at a database separate from dev/production.'
    );
  }
  if (runtimeUrl !== testEnv.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL does not match backend/.env.test. Refusing to run e2e tests against an unexpected database — use `npm run test:e2e`.'
    );
  }
  if (devEnv.DATABASE_URL && runtimeUrl === devEnv.DATABASE_URL) {
    throw new Error(
      'backend/.env.test has the same DATABASE_URL as backend/.env. e2e tests would run against your dev/production database — point .env.test at a separate database.'
    );
  }
}
