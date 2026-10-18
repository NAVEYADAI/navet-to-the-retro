/**
 * Which database is this process actually using? Logged at startup so "my dev server is pointing at production"
 * is visible in the first lines of output instead of discovered later. Only host and database name are ever
 * reported — never the user, the password or the query string.
 */
export interface DbTarget {
  host: string;
  database: string;
  appEnv: string | null;
  /** Human-readable warnings; empty when the setup looks right. */
  warnings: string[];
}

export function describeDbTarget(env: NodeJS.ProcessEnv): DbTarget {
  const appEnv = env.APP_ENV?.trim() || null;
  let host = '(DATABASE_URL not set)';
  let database = '';
  try {
    if (env.DATABASE_URL) {
      const u = new URL(env.DATABASE_URL);
      host = u.port ? `${u.hostname}:${u.port}` : u.hostname;
      database = u.pathname.replace(/^\//, '');
    }
  } catch {
    host = '(DATABASE_URL is not a valid URL)';
  }

  const warnings: string[] = [];
  const isProductionProcess = env.NODE_ENV === 'production';
  if (isProductionProcess && appEnv === 'development') {
    warnings.push('NODE_ENV=production but APP_ENV=development — a production process marked as development.');
  }
  if (!isProductionProcess && env.NODE_ENV !== 'test' && appEnv !== 'development') {
    warnings.push(
      'This is a non-production server but APP_ENV is not "development" — it may be connected to the PRODUCTION database. ' +
        'Run `npm run env:set-dev-db` (and check the root .env too, if docker-compose reads it).',
    );
  }
  return { host, database, appEnv, warnings };
}
