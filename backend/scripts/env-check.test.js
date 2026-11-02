'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkEnv, classifyDb, parseEnv } = require('./env-check.js');

const POLICY = { developmentHosts: ['ep-dev-1'], productionHosts: ['ep-prod-1'], devContainer: 'c' };
const SECRET = 'S3CR3T-DO-NOT-PRINT';
const DEV = `postgresql://u:${SECRET}@ep-dev-1-pooler.c-6.eu-central-1.aws.neon.tech/db`;
const PROD = `postgresql://u:${SECRET}@ep-prod-1-pooler.c-6.eu-central-1.aws.neon.tech/db`;
const TEST = `postgresql://test:test@localhost:5433/navet_test`;

const good = () => ({
  files: {
    '.env': { text: `APP_ENV=development\nDATABASE_URL=${DEV}\nJWT_SECRET=${SECRET}\n`, mode: 0o600 },
    'backend/.env': { text: `APP_ENV=development\nDATABASE_URL=${DEV}\nJWT_SECRET=${SECRET}\n`, mode: 0o600 },
    'frontend/.env': { text: 'EXPO_PUBLIC_PORT=1\n', mode: 0o600 },
    'backend/.env.test': { text: `DATABASE_URL=${TEST}\nBACKEND_PORT=5006\nJWT_SECRET=x\n`, mode: 0o600 },
  },
  ignored: new Set(['.env', 'backend/.env', 'frontend/.env', 'backend/.env.test']),
  policy: POLICY,
});
const errors = (ctx) => checkEnv(ctx).filter((r) => r.level === 'error');

test('classifyDb tells development, production, test and unknown apart by endpoint id', () => {
  assert.equal(classifyDb(DEV, POLICY).kind, 'development');
  assert.equal(classifyDb(PROD, POLICY).kind, 'production');
  assert.equal(classifyDb(TEST, POLICY).kind, 'test');
  assert.equal(classifyDb('postgresql://u:p@ep-other.neon.tech/db', POLICY).kind, 'unknown');
  assert.equal(classifyDb('not a url', POLICY).kind, 'invalid');
});

test('a correct environment has no errors', () => {
  assert.deepEqual(errors(good()), []);
});

test('APP_ENV missing is an error naming the key and the file', () => {
  const ctx = good();
  ctx.files['backend/.env'].text = `DATABASE_URL=${DEV}\nJWT_SECRET=x\n`;
  const e = errors(ctx);
  assert.ok(e.some((r) => r.area === 'backend/.env' && /APP_ENV/.test(r.message)));
});

test('a production DATABASE_URL is an error with a fix hint', () => {
  const ctx = good();
  ctx.files['.env'].text = `APP_ENV=development\nDATABASE_URL=${PROD}\nJWT_SECRET=x\n`;
  const e = errors(ctx);
  assert.ok(e.some((r) => /PRODUCTION/.test(r.message) && r.fix));
});

test('compose file and backend file pointing at different databases is an error', () => {
  const ctx = good();
  ctx.files['.env'].text = `APP_ENV=development\nDATABASE_URL=${PROD}\nJWT_SECRET=x\n`;
  assert.ok(errors(ctx).some((r) => r.area === '.env vs backend/.env'));
});

test('the test env file must be the local test database on 5006', () => {
  const ctx = good();
  ctx.files['backend/.env.test'].text = `DATABASE_URL=${DEV}\nBACKEND_PORT=5005\nJWT_SECRET=x\n`;
  const e = errors(ctx);
  assert.ok(e.some((r) => /local test DB/.test(r.message)));
  assert.ok(e.some((r) => /5006/.test(r.message)));
});

test('a file that git does not ignore is an error', () => {
  const ctx = good();
  ctx.ignored.delete('backend/.env');
  assert.ok(errors(ctx).some((r) => /NOT ignored/.test(r.message)));
});

test('a container running with the wrong APP_ENV or on production is an error', () => {
  const wrongEnv = { ...good(), container: { appEnv: '', host: 'ep-dev-1-pooler.x.neon.tech' } };
  assert.ok(errors(wrongEnv).some((r) => /APP_ENV/.test(r.message)));
  const onProd = { ...good(), container: { appEnv: 'development', host: 'ep-prod-1-pooler.x.neon.tech' } };
  assert.ok(errors(onProd).some((r) => /PRODUCTION/.test(r.message)));
  const fine = { ...good(), container: { appEnv: 'development', host: 'ep-dev-1-pooler.x.neon.tech' } };
  assert.deepEqual(errors(fine), []);
});

test('no value ever appears in the report', () => {
  const ctx = good();
  ctx.files['.env'].text = `APP_ENV=development\nDATABASE_URL=${PROD}\nJWT_SECRET=${SECRET}\nEXTRA_KEY=${SECRET}\n`;
  const text = JSON.stringify(checkEnv({ ...ctx, container: { appEnv: 'development', host: 'ep-prod-1.x.neon.tech' } }));
  assert.ok(!text.includes(SECRET));
  assert.ok(!text.includes('u:' ));
});

test('parseEnv ignores comments and strips quotes', () => {
  const m = parseEnv('# A=1\nB="two"\nexport C=3\n');
  assert.equal(m.has('A'), false);
  assert.equal(m.get('B'), 'two');
  assert.equal(m.get('C'), '3');
});

test('the development migrate refuses a production DATABASE_URL before touching any database', () => {
  const { spawnSync } = require('node:child_process');
  const policy = require('./env-policy.json');
  const url = `postgresql://u:p@${policy.productionHosts[0]}-pooler.c-6.eu-central-1.aws.neon.tech/db`;
  const r = spawnSync('node', ['scripts/db-migrate.js', 'dev'], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { PATH: process.env.PATH, APP_ENV: 'development', DATABASE_URL: url },
    encoding: 'utf8',
  });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}${r.stderr}`, /PRODUCTION/);
});
