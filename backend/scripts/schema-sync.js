// Keeps the schema honest across the three environments. Production gets its schema by a manual Prisma "db push"
// (its image never runs it), so "tests green" and "deploy works" can drift apart:
//   push-test / check-test   isolated test DB (localhost:5433 only).
//   push-dev  / check-dev    the DEVELOPMENT database — refuses unless APP_ENV=development, and refuses if its
//                            host equals PROD_DATABASE_URL. Pooled Neon URLs are turned into the direct endpoint
//                            for the Prisma CLI (the pooler does not suit schema pushes).
//   check-prod               read-only: is production in sync? Needs PROD_DATABASE_URL — NEVER read from backend/.env
//                            (that file is the development DB now). Run by deploy.sh before the Fly deploy, on YOUR
//                            machine. It only compares; applying the fix (a push on production) stays manual.
// The DB URL travels in the environment only — never on a command line or in output.
const { spawnSync } = require('node:child_process');

const mode = process.argv[2];
const schemaPath = process.env.SCHEMA_PATH || 'prisma/schema.prisma';
const allowLocal = process.env.SCHEMA_SYNC_ALLOW_LOCAL === '1'; // self-tests only

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function describeTarget(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return '(unparseable URL)';
  }
}

function isIsolatedTestDb(url) {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1'].includes(u.hostname) && u.port === '5433';
  } catch {
    return false;
  }
}

function toDirect(url) {
  return url.replace(/-pooler(\.)/, '$1'); // Neon: same compute, direct (non-pgbouncer) endpoint
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace('-pooler', '');
  } catch {
    return '';
  }
}

function prisma(args, url) {
  return spawnSync('npx', ['prisma', ...args], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  });
}

function diff(url, extra = []) {
  return prisma(
    ['migrate', 'diff', '--from-schema-datasource', schemaPath, '--to-schema-datamodel', schemaPath, ...extra],
    url,
  );
}

function check(url, label) {
  console.log(`Comparing ${schemaPath} with ${label}: ${describeTarget(url)}`);
  const r = diff(url, ['--exit-code']);
  if (r.status === 0) {
    console.log(`✔ ${label} is in sync with the schema.`);
    return;
  }
  if (r.status === 2) {
    const sql = diff(url, ['--script']).stdout.trim();
    console.error(`\nSQL needed to bring ${label} in line with the schema:\n\n${sql}\n`);
    const how =
      label === 'production'
        ? 'Deploying now would ship code that expects tables/columns the live DB does not have. ' +
          'Review the SQL above; applying it to production needs explicit approval — do not deploy first.'
        : label === 'the development DB'
          ? 'Run `npm run schema:dev:push` to update the development DB.'
          : 'Run `npm run schema:test:push` to update the test DB.';
    fail(`${label} is NOT in sync with ${schemaPath}. ${how}`);
  }
  fail(`Could not compare ${label}:\n${(r.stderr || r.stdout || '').trim().split('\n').slice(-6).join('\n')}`);
}

function push(url, label) {
  console.log(`Applying ${schemaPath} to ${label}: ${describeTarget(url)}`);
  const r = prisma(['db', 'push', '--skip-generate', '--schema', schemaPath], url);
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) fail(`The push to ${label} failed (a destructive change needs a manual look).`);
}

if (mode === 'push-test' || mode === 'check-test') {
  const url = process.env.DATABASE_URL || '';
  if (!isIsolatedTestDb(url) && !allowLocal) {
    fail(
      'Refusing: DATABASE_URL is not the isolated test DB (localhost:5433). ' +
        'Run this through the npm script, which loads backend/.env.test.',
    );
  }
  if (mode === 'check-test') check(url, 'the test DB');
  else push(url, 'the test DB');
} else if (mode === 'push-dev' || mode === 'check-dev') {
  const url = process.env.DATABASE_URL || '';
  if (process.env.APP_ENV !== 'development') {
    fail(
      'Refusing: APP_ENV is not "development". Point backend/.env at the development database with ' +
        '`npm run env:set-dev-db` (or set APP_ENV=development next to DATABASE_URL in your secrets manager).',
    );
  }
  if (!url) fail('DATABASE_URL is not set.');
  const prod = process.env.PROD_DATABASE_URL;
  if (prod && hostOf(prod) === hostOf(url)) {
    fail('DATABASE_URL has the same host as PROD_DATABASE_URL — that is production, not development.');
  }
  const direct = toDirect(url);
  if (mode === 'check-dev') check(direct, 'the development DB');
  else push(direct, 'the development DB');
} else if (mode === 'check-prod') {
  const url = process.env.PROD_DATABASE_URL || '';
  if (!url) {
    fail(
      'PROD_DATABASE_URL is not set. The production URL is deliberately NOT in backend/.env (that is the development DB). ' +
        'Provide it only for the deploy, e.g. `PROD_DATABASE_URL=… ./deploy.sh`, or run deploy.sh under the production ' +
        'environment of your secrets manager.',
    );
  }
  let local = false;
  try {
    local = ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
  } catch {
    /* unparseable URL is reported by prisma */
  }
  if (local && !allowLocal) {
    fail('PROD_DATABASE_URL points at localhost — that is not production, so the check would prove nothing.');
  }
  if (process.env.DATABASE_URL && process.env.APP_ENV === 'development' && hostOf(process.env.DATABASE_URL) === hostOf(url)) {
    fail('PROD_DATABASE_URL has the same host as the development DATABASE_URL — check which one you copied.');
  }
  console.log('Production check — comparing the live DB in PROD_DATABASE_URL with the schema (read-only).');
  check(toDirect(url), 'production');
} else {
  fail('Usage: node scripts/schema-sync.js <push-test|check-test|push-dev|check-dev|check-prod>');
}
