// Keeps the schema honest across environments. Prod gets its schema by a manual `prisma db push`
// (the production image never runs it), so "tests green" and "deploy works" can drift apart:
//   push-test   apply prisma/schema.prisma to the isolated test DB (localhost:5433 only) — so e2e
//               always runs on exactly the schema the code expects.
//   check-test  read-only: is the test DB in sync with schema.prisma?
//   check-prod  read-only: is the production DB in sync? Run by `deploy.sh` BEFORE `fly deploy`, on
//               YOUR machine with YOUR credentials (PROD_DATABASE_URL, else DATABASE_URL from .env).
//               It only compares schemas — never writes. Fixing a mismatch (`db push` on Neon) stays a
//               manual, explicitly approved step.
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
    fail(
      `${label} is NOT in sync with ${schemaPath}. ` +
        (label === 'production'
          ? 'Deploying now would ship code that expects tables/columns the live DB does not have. ' +
            'Review the SQL above; applying it (`prisma db push` on Neon) needs explicit approval — do not deploy first.'
          : 'Run `npm run schema:test:push` to update the test DB.'),
    );
  }
  fail(`Could not compare ${label}:\n${(r.stderr || r.stdout || '').trim().split('\n').slice(-6).join('\n')}`);
}

if (mode === 'push-test' || mode === 'check-test') {
  const url = process.env.DATABASE_URL || '';
  if (!isIsolatedTestDb(url) && !allowLocal) {
    fail(
      'Refusing: DATABASE_URL is not the isolated test DB (localhost:5433). ' +
        'Run this through the npm script, which loads backend/.env.test.',
    );
  }
  if (mode === 'check-test') {
    check(url, 'the test DB');
  } else {
    console.log(`Applying ${schemaPath} to the test DB: ${describeTarget(url)}`);
    const r = prisma(['db', 'push', '--skip-generate', '--schema', schemaPath], url);
    process.stdout.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    if (r.status !== 0) fail('prisma db push to the test DB failed (a destructive change needs a manual look).');
  }
} else if (mode === 'check-prod') {
  const url = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!url) fail('No database URL. Set PROD_DATABASE_URL, or run via the npm script (loads backend/.env).');
  let local = false;
  try { local = ['localhost', '127.0.0.1'].includes(new URL(url).hostname); } catch { /* handled below */ }
  if (local && !allowLocal) {
    fail('The URL points at localhost — that is not production, so the check would prove nothing. Set PROD_DATABASE_URL.');
  }
  console.log('Production check — assumes the live DB is the one in PROD_DATABASE_URL (else backend/.env DATABASE_URL).');
  check(url, 'production');
} else {
  fail('Usage: node scripts/schema-sync.js <push-test|check-test|check-prod>');
}
