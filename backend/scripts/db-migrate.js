// Database migrations (Prisma Migrate) across the three environments.
//
//   new <name>   Writes prisma/migrations/<ts>_<name>/migration.sql for the pending change in schema.prisma, by diffing the
//                isolated test DB (all existing migrations applied) against the schema. You review that file in git.
//   test         Applies migrations to the isolated test DB (localhost:5433 only) and fails if schema.prisma has a change
//                that no migration covers. Runs before every e2e run. The test DB is disposable: a leftover db-push state
//                is wiped and rebuilt from the migrations.
//   dev          Applies pending migrations to the DEVELOPMENT DB — only when APP_ENV=development and the host is not
//                production. Runs when the dev container starts. A dev DB created by the old `db push` is adopted
//                (marked as already migrated) when it already matches the schema.
//   release      Fly's release_command, inside the NEW image, before the new version serves traffic, with the app's own
//                DATABASE_URL: refuses unmarked destructive migrations, then `prisma migrate deploy`. Any failure aborts
//                the deploy and the running version stays up. Nothing runs when the app itself starts.
//   check-files  Static check (no DB): destructive statements need an explicit `-- destructive-ok: <reason>` line.
//   baseline-prod  ONCE, by you: marks the first migration as already applied in production (the DB predates migrations).
//
// The DB URL travels in the environment only — never on a command line or in output.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = process.env.SCHEMA_PATH || 'prisma/schema.prisma';
const migrationsDir = process.env.MIGRATIONS_DIR || path.join(path.dirname(schemaPath), 'migrations');
const mode = process.argv[2];

// Statements that can lose data or fail on existing rows. They must be acknowledged in the file, in git, in review.
const DESTRUCTIVE = [
  [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
  [/\bDROP\s+COLUMN\b/i, 'DROP COLUMN'],
  [/\bDROP\s+TYPE\b/i, 'DROP TYPE'],
  [/\bTRUNCATE\b/i, 'TRUNCATE'],
  [/\bDELETE\s+FROM\b/i, 'DELETE FROM'],
  [/\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b/i, 'SET NOT NULL (fails or needs a backfill when rows exist)'],
  [/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i, 'ALTER COLUMN TYPE'],
];
const MARKER = /^[ \t]*--[ \t]*destructive-ok:[ \t]*\S+/im;

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

function hostOf(url) {
  try {
    return new URL(url).hostname.replace('-pooler', '');
  } catch {
    return '';
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

/** Neon: the pooled endpoint cannot hold the advisory lock a migration takes; the direct one is the same compute. */
function toDirect(url) {
  return url.replace(/-pooler(\.)/, '$1');
}

function prisma(args, url) {
  return spawnSync('npx', ['prisma', ...args], { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8' });
}

function show(r) {
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
}

function tail(r, n = 8) {
  return (r.stderr || r.stdout || '').trim().split('\n').slice(-n).join('\n');
}

function migrationFolders() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function checkFiles() {
  const problems = [];
  for (const dir of migrationFolders()) {
    const file = path.join(migrationsDir, dir, 'migration.sql');
    if (!fs.existsSync(file)) {
      problems.push(`${dir}: migration.sql is missing`);
      continue;
    }
    const sql = fs.readFileSync(file, 'utf8');
    if (MARKER.test(sql)) continue;
    // Look at statements only — a word inside a `--` comment is not a statement.
    const code = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    for (const [re, label] of DESTRUCTIVE) if (re.test(code)) problems.push(`${dir}: ${label}`);
  }
  return problems;
}

function requireCleanFiles() {
  const problems = checkFiles();
  if (!problems.length) return;
  fail(
    `Destructive migration(s) with no acknowledgement:\n  - ${problems.join('\n  - ')}\n` +
      'If this is intended, plan the data first (backup / backfill in the same file), then add a line\n' +
      '`-- destructive-ok: <why this is safe>` at the top of that migration.sql and commit it.',
  );
}

function drift(url) {
  return prisma(['migrate', 'diff', '--from-schema-datasource', schemaPath, '--to-schema-datamodel', schemaPath, '--exit-code'], url);
}

function driftScript(url) {
  return prisma(['migrate', 'diff', '--from-schema-datasource', schemaPath, '--to-schema-datamodel', schemaPath, '--script'], url);
}

function deploy(url, label) {
  console.log(`Applying migrations to ${label}: ${describeTarget(url)}`);
  const r = prisma(['migrate', 'deploy', '--schema', schemaPath], url);
  show(r);
  return r;
}

function requireTestUrl() {
  const url = process.env.DATABASE_URL || '';
  if (!isIsolatedTestDb(url)) {
    fail('Refusing: DATABASE_URL is not the isolated test DB (localhost:5433). Run this through the npm script, which loads backend/.env.test.');
  }
  return url;
}

/** Test DB only: apply the migrations, rebuilding from scratch if it still has the old db-push state. */
function applyToTestDb(url) {
  let r = deploy(url, 'the test DB');
  if (r.status !== 0 && /P3005|P3009|P3018/.test(`${r.stderr}${r.stdout}`)) {
    console.log('The test DB is in an old or failed state — it is disposable, rebuilding it from the migrations.');
    const reset = prisma(['migrate', 'reset', '--force', '--skip-generate', '--skip-seed', '--schema', schemaPath], url);
    show(reset);
    if (reset.status !== 0) fail(`Could not rebuild the test DB:\n${tail(reset)}`);
    return;
  }
  if (r.status !== 0) fail(`Applying the migrations to the test DB failed:\n${tail(r)}`);
}

function assertInSync(url, label, how) {
  const d = drift(url);
  if (d.status === 0) return;
  const script = driftScript(url);
  console.error(`\nDifference between ${label} and ${schemaPath}:\n${(script.stdout || '').trim() || tail(d)}\n`);
  fail(`${label} does not match ${schemaPath}. ${how}`);
}

/** SQL without comments and formatting, so a generated diff and a migration file can be compared. */
function normalizeSql(sql) {
  return sql
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Marks the first (baseline) migration as applied on a database that predates migrations — only when that is provably safe. */
function adoptPredatingDb(url) {
  const [first, ...later] = migrationFolders();
  if (!first) fail('There are no migrations to use as a baseline.');
  const script = driftScript(url);
  if (script.status !== 0) fail(`Could not compare the database with the schema:\n${tail(script)}`);
  const missing = normalizeSql(script.stdout || '');
  const expected = normalizeSql(later.map((m) => fs.readFileSync(path.join(migrationsDir, m, 'migration.sql'), 'utf8')).join('\n'));
  if (missing !== expected) {
    console.error(`\nThe database lacks:\n${(script.stdout || '').trim() || '(nothing)'}\n\nThe later migrations contain:\n${expected || '(nothing)'}\n`);
    fail(
      'The database has no migration history and it is NOT exactly "baseline + the later migrations", so it will not be adopted automatically. ' +
        'Inspect the difference above, then mark the baseline yourself: PROD_DATABASE_URL=… npm run migrate:baseline-prod --prefix backend',
    );
  }
  console.log(`The database predates migrations and is exactly the baseline plus ${later.length} later migration(s) — marking ${first} as applied (nothing is executed for it).`);
  const res = prisma(['migrate', 'resolve', '--applied', first, '--schema', schemaPath], url);
  show(res);
  if (res.status !== 0) fail(`Could not mark the baseline:\n${tail(res)}`);
}

function requireDevEnv() {
  const url = process.env.DATABASE_URL || '';
  if (process.env.APP_ENV !== 'development') return { skip: 'APP_ENV is not "development"' };
  if (!url) return { skip: 'DATABASE_URL is not set' };
  const prod = process.env.PROD_DATABASE_URL;
  if (prod && hostOf(prod) === hostOf(url)) return { fatal: 'DATABASE_URL has the same host as PROD_DATABASE_URL — that is production, not development.' };
  return { url: toDirect(url) };
}

function main() {
  if (mode === 'check-files') {
    requireCleanFiles();
    console.log(`✔ ${migrationFolders().length} migration(s), none destructive without acknowledgement.`);
    return;
  }

  if (mode === 'test') {
    const url = requireTestUrl();
    applyToTestDb(url);
    assertInSync(url, 'the migrated test DB', 'schema.prisma has a change that no migration covers — run `npm run migrate:new --prefix backend -- <name>` and commit the new folder.');
    console.log('✔ test DB is migrated and matches the schema.');
    return;
  }

  if (mode === 'new') {
    const name = (process.argv[3] || '').trim();
    if (!/^[a-z0-9_]+$/.test(name)) fail('Usage: npm run migrate:new --prefix backend -- <snake_case_name>');
    const url = requireTestUrl();
    applyToTestDb(url);
    const script = driftScript(url);
    if (script.status !== 0) fail(`Could not compare the test DB with the schema:\n${tail(script)}`);
    const sql = (script.stdout || '').trim();
    if (!sql || /^-- This is an empty migration\.?$/i.test(sql)) return console.log('✔ schema.prisma has no change that is missing a migration.');
    const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const dir = path.join(migrationsDir, `${ts}_${name}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'migration.sql'), `${sql}\n`);
    const lock = path.join(migrationsDir, 'migration_lock.toml');
    if (!fs.existsSync(lock)) fs.writeFileSync(lock, '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "postgresql"\n');
    console.log(`\n── ${path.relative(process.cwd(), dir)}/migration.sql ──\n${sql}\n`);
    const problems = checkFiles();
    if (problems.length) console.log(`⚠ Needs your attention before it can ship:\n  - ${problems.join('\n  - ')}\n  Plan the data (backup / backfill) in this file and add a line \`-- destructive-ok: <why safe>\`.\n`);
    applyToTestDb(url);
    assertInSync(url, 'the migrated test DB', 'the generated migration does not reproduce the schema — check the SQL above.');
    console.log('✔ Migration written and verified on the test DB. Review it, commit it, and the next deploy applies it.');
    return;
  }

  if (mode === 'dev') {
    const dev = requireDevEnv();
    if (dev.fatal) fail(dev.fatal);
    if (dev.skip) fail(`Refusing: ${dev.skip}. Point backend/.env at the development database with \`npm run env:set-dev-db\`.`);
    let r = deploy(dev.url, 'the development DB');
    if (r.status !== 0 && /P3005/.test(`${r.stderr}${r.stdout}`)) {
      // A dev DB built by the old `db push`. If it already matches the schema it is fully migrated; adopt it as such.
      if (drift(dev.url).status !== 0) {
        fail('The development DB predates migrations and does not match schema.prisma, so it cannot be adopted automatically. Mark the baseline yourself: `npx prisma migrate resolve --applied <first migration folder>`, then run this again.');
      }
      console.log('The development DB predates migrations and already matches the schema — marking every migration as applied.');
      for (const m of migrationFolders()) {
        const res = prisma(['migrate', 'resolve', '--applied', m, '--schema', schemaPath], dev.url);
        if (res.status !== 0) fail(`Could not mark ${m} as applied:\n${tail(res)}`);
      }
      r = deploy(dev.url, 'the development DB');
    }
    if (r.status !== 0) fail(`Applying the migrations to the development DB failed:\n${tail(r)}`);
    return;
  }

  if (mode === 'release') {
    // Fly release_command: runs in the NEW image, before the new version serves traffic. Uses the app's own DATABASE_URL.
    const url = process.env.DATABASE_URL || '';
    if (!url) fail('release: DATABASE_URL is not set in the release environment.');
    requireCleanFiles();
    const direct = toDirect(url);
    let r = deploy(direct, 'the database');
    if (r.status !== 0 && /P3005/.test(`${r.stderr}${r.stdout}`)) {
      // First deploy after the move to migrations: the database was built by the old `db push`, so it has tables but no
      // migration history. Adopt it ONLY if it is provably "the baseline + exactly the later migrations": what the
      // database lacks versus the schema must be the same SQL the later migration files contain.
      adoptPredatingDb(direct);
      r = deploy(direct, 'the database');
    }
    if (r.status !== 0) fail(`The migration failed — the deploy is stopped and the running version is untouched:\n${tail(r, 12)}`);
    console.log('✔ database is up to date.');
    return;
  }

  if (mode === 'baseline-prod') {
    const url = process.env.PROD_DATABASE_URL || '';
    if (!url) fail('PROD_DATABASE_URL is not set. Provide it only for this command: PROD_DATABASE_URL=… npm run migrate:baseline-prod --prefix backend');
    if (process.env.DATABASE_URL && process.env.APP_ENV === 'development' && hostOf(process.env.DATABASE_URL) === hostOf(url)) {
      fail('PROD_DATABASE_URL has the same host as the development DATABASE_URL — check which one you copied.');
    }
    const first = migrationFolders()[0];
    if (!first) fail('There are no migrations to use as a baseline.');
    const direct = toDirect(url);
    console.log(`Production: ${describeTarget(direct)}\nBaseline migration: ${first} (it describes the schema production already has; it is only marked as applied, nothing is executed).`);
    const res = prisma(['migrate', 'resolve', '--applied', first, '--schema', schemaPath], direct);
    show(res);
    if (res.status !== 0) fail(`Could not mark the baseline:\n${tail(res)}`);
    const pending = driftScript(direct);
    console.log(`\nWhat production still lacks versus the schema (the next deploy applies exactly the later migrations):\n\n${(pending.stdout || '').trim() || '(nothing)'}\n`);
    return;
  }

  fail('Usage: node scripts/db-migrate.js <new <name>|test|dev|release|check-files|baseline-prod>');
}

main();
