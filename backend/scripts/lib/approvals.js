// Production schema approvals. An approval is a small JSON file, committed to git (so your partner sees it in the
// PR) and baked into the image. It is bound to the EXACT SQL plan: the release step recomputes the plan against
// the live database and only applies it if an approval for that very SQL exists. A different schema change, or a
// production DB that has drifted since you reviewed it, produces a different plan id => not approved => deploy stops.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const APPROVALS_DIR = process.env.SCHEMA_APPROVALS_DIR || path.join(BACKEND_ROOT, 'schema-approvals');
const FIXES_DIR = process.env.SCHEMA_FIXES_DIR || path.join(BACKEND_ROOT, 'schema-fixes');

const short = (hash) => hash.slice(0, 12);
const approvalFile = (hash) => path.join(APPROVALS_DIR, `${short(hash)}.json`);
const preFixFile = (hash) => path.join(FIXES_DIR, `${short(hash)}.pre.sql`);

/** The approval for this plan, or null. It must match the full hash AND the SQL text. */
function findApproval(plan) {
  const file = approvalFile(plan.hash);
  if (!fs.existsSync(file)) return null;
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.planHash !== plan.hash || record.sql !== plan.sql) return null;
  return record;
}

/** The reviewed pre-step SQL a person drafted for this plan (schema-fixes/<id>.pre.sql), or ''. */
function readPreFix(plan) {
  const file = preFixFile(plan.hash);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
}

/** Unfilled `<placeholder>` markers in a fix draft mean it was not actually finished. */
function unresolvedPlaceholders(sql) {
  return sql.match(/<[A-Za-z][A-Za-z0-9 _-]{0,40}>/g) || [];
}

function gitUserName() {
  const r = spawnSync('git', ['config', 'user.name'], { encoding: 'utf8' });
  return (r.stdout || '').trim() || 'unknown';
}

function writeApproval(plan, { pre = '', note = '' } = {}) {
  fs.mkdirSync(APPROVALS_DIR, { recursive: true });
  const record = {
    planHash: plan.hash,
    target: 'production',
    approvedBy: gitUserName(),
    approvedAt: new Date().toISOString(),
    risk: plan.risk,
    tables: plan.tables,
    note,
    pre,
    sql: plan.sql,
  };
  const file = approvalFile(plan.hash);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

/** The script release runs: reviewed pre-step first, then the planned SQL — all or nothing. */
function buildApplyScript(plan, approval) {
  return ['BEGIN;', approval.pre ? approval.pre.replace(/;?\s*$/, ';') : '', plan.sql, 'COMMIT;'].filter(Boolean).join('\n\n');
}

module.exports = { APPROVALS_DIR, FIXES_DIR, findApproval, readPreFix, unresolvedPlaceholders, writeApproval, buildApplyScript, short, approvalFile, preFixFile };
