// node --test backend/scripts/lib   (npm run test:scripts --prefix backend)
// Fixtures in __fixtures__/ are REAL `prisma migrate diff --script` outputs, generated from schema variants
// against the isolated test DB — so the classifier is checked against what Prisma actually emits.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPlan, splitStatements, planHash, formatPlan } = require('./schema-plan');

const fixture = (name) => fs.readFileSync(path.join(__dirname, '__fixtures__', `${name}.sql`), 'utf8');
const ops = (plan) => plan.items.map((i) => i.op);

test('an empty diff is an empty, risk-free plan', () => {
  const plan = buildPlan('');
  assert.equal(plan.empty, true);
  assert.equal(plan.risk, 'none');
  assert.match(formatPlan(plan, { label: 'prod' }), /nothing to apply/);
});

test('optional new column is safe', () => {
  const plan = buildPlan(fixture('add-nullable'));
  assert.deepEqual(ops(plan), ['add-column']);
  assert.equal(plan.risk, 'safe');
  assert.equal(plan.fixes.length, 0);
});

test('new column with a default needs review (existing rows get the default)', () => {
  const plan = buildPlan(fixture('add-default'));
  assert.deepEqual(ops(plan), ['add-column-default']);
  assert.equal(plan.risk, 'review');
  assert.match(plan.items[0].why, /EXISTING row/);
  assert.equal(plan.fixes[0].about, 'User."probeFlag"');
});

test('required column without default needs review and gets a three-step fix', () => {
  const plan = buildPlan(fixture('add-notnull'));
  assert.deepEqual(ops(plan), ['add-column-not-null']);
  assert.equal(plan.risk, 'review');
  assert.match(plan.fixes[0].sql, /ADD COLUMN "probeReq"/);
  assert.match(plan.fixes[0].sql, /UPDATE "User"/);
});

test('dropping a column is destructive and the fix keeps a backup', () => {
  const plan = buildPlan(fixture('drop-column'));
  assert.deepEqual(ops(plan), ['drop-column']);
  assert.equal(plan.risk, 'destructive');
  assert.match(plan.fixes[0].sql, /CREATE TABLE "_bak_User_lastName"/);
});

test('drop + add on one table is recognised as a probable rename, with the RENAME draft', () => {
  const plan = buildPlan(fixture('rename-looking'));
  assert.deepEqual(ops(plan).sort(), ['add-column', 'drop-column']);
  assert.equal(plan.risk, 'destructive');
  assert.equal(plan.fixes.length, 1);
  assert.match(plan.fixes[0].text, /looks like a RENAME/);
  assert.equal(plan.fixes[0].sql, 'ALTER TABLE "User" RENAME COLUMN "lastName" TO "familyName";');
});

test('a new table with an index is safe', () => {
  const plan = buildPlan(fixture('create-table'));
  assert.deepEqual(ops(plan), ['create-table', 'create-index']);
  assert.equal(plan.risk, 'safe');
  assert.deepEqual(plan.tables, ['ProbeThing']);
});

test('a unique index on existing data needs review with a duplicates check', () => {
  const plan = buildPlan(fixture('unique-index'));
  assert.deepEqual(ops(plan), ['create-unique-index']);
  assert.equal(plan.risk, 'review');
  assert.match(plan.fixes[0].sql, /HAVING count\(\*\) > 1/);
});

test('overall risk is the worst item', () => {
  const plan = buildPlan(`${fixture('add-nullable')}\n${fixture('drop-column')}`);
  assert.equal(plan.risk, 'destructive');
  assert.equal(plan.statements.length, 2);
});

test('hash ignores whitespace and comments, but changes with the SQL', () => {
  const a = buildPlan('-- c\nALTER TABLE "User" ADD COLUMN   "x" TEXT;');
  const b = buildPlan('ALTER TABLE "User"\n  ADD COLUMN "x" TEXT;\n\n-- another comment');
  const c = buildPlan('ALTER TABLE "User" ADD COLUMN "y" TEXT;');
  assert.equal(a.hash, b.hash);
  assert.notEqual(a.hash, c.hash);
  assert.equal(a.hash, planHash(a.statements));
});

test('semicolons and dashes inside string literals do not split or comment a statement', () => {
  const sql = `ALTER TABLE "T" ADD COLUMN "x" TEXT NOT NULL DEFAULT 'a;b -- not a comment';`;
  assert.equal(splitStatements(sql).length, 1);
  assert.match(buildPlan(sql).items[0].why, /EXISTING row/);
});

test('backup tables from an approved fix are kept: their drop is never planned', () => {
  const plan = buildPlan('DROP TABLE "_bak_User_lastName";');
  assert.equal(plan.empty, true);
  // …but any other table drop still is planned, and is destructive
  const other = buildPlan('DROP TABLE "_bak_User_lastName";\nDROP TABLE "Comment";');
  assert.deepEqual(other.items.map((i) => i.op), ['drop-table']);
  assert.equal(other.risk, 'destructive');
});

test('unknown statements are never silently safe', () => {
  const plan = buildPlan('VACUUM FULL "User";');
  assert.equal(plan.items[0].op, 'unknown');
  assert.equal(plan.risk, 'review');
});

test('the report names risk, id, fixes and the SQL', () => {
  const text = formatPlan(buildPlan(fixture('rename-looking')), { label: 'production', counts: { User: 12 } });
  assert.match(text, /overall risk .*DESTRUCTIVE/);
  assert.match(text, /Plan id: [0-9a-f]{12}/);
  assert.match(text, /\[12 row\(s\) in "User"\]/);
  assert.match(text, /Suggested fixes/);
  assert.match(text, /SQL that will run:/);
});
