const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function run(migrations) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
  for (const [name, sql] of Object.entries(migrations)) {
    fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, name, 'migration.sql'), sql);
  }
  return spawnSync('node', [path.join(__dirname, 'db-migrate.js'), 'check-files'], {
    env: { ...process.env, MIGRATIONS_DIR: dir },
    encoding: 'utf8',
  });
}

test('an additive migration passes', () => {
  const r = run({ '1_add': 'ALTER TABLE "User" ADD COLUMN "x" TEXT;\nCREATE TABLE "T" ("id" SERIAL);' });
  assert.strictEqual(r.status, 0, r.stderr);
});

test('DROP COLUMN without acknowledgement is refused', () => {
  const r = run({ '1_drop': 'ALTER TABLE "User" DROP COLUMN "x";' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /DROP COLUMN/);
});

test('SET NOT NULL and a type change are refused', () => {
  assert.strictEqual(run({ '1_nn': 'ALTER TABLE "User" ALTER COLUMN "x" SET NOT NULL;' }).status, 1);
  assert.strictEqual(run({ '1_ty': 'ALTER TABLE "User" ALTER COLUMN "x" TYPE INTEGER;' }).status, 1);
});

test('a destructive-ok line with a reason acknowledges it', () => {
  const r = run({ '1_drop': '-- destructive-ok: column was never populated\nALTER TABLE "User" DROP COLUMN "x";' });
  assert.strictEqual(r.status, 0, r.stderr);
});

test('a bare destructive-ok marker without a reason does not count', () => {
  assert.strictEqual(run({ '1_drop': '-- destructive-ok:\nALTER TABLE "User" DROP COLUMN "x";' }).status, 1);
});

test('a destructive word inside a comment is not a statement', () => {
  assert.strictEqual(run({ '1_c': '-- we did not DROP COLUMN anything\nALTER TABLE "User" ADD COLUMN "x" TEXT;' }).status, 0);
});

test('a folder without migration.sql is refused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
  fs.mkdirSync(path.join(dir, '1_empty'));
  const r = spawnSync('node', [path.join(__dirname, 'db-migrate.js'), 'check-files'], { env: { ...process.env, MIGRATIONS_DIR: dir }, encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
});
