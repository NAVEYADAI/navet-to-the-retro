// Keeps the schema honest across the three environments.
//
//   test        push-test / check-test    isolated test DB (localhost:5433 only), updated automatically before e2e.
//   development push-dev / check-dev       the development DB — refuses unless APP_ENV=development and its host is not
//               plan-dev                   production. Runs automatically when the dev container starts or schema.prisma
//                                          changes. plan-dev = read-only analysis (used by the editor hook).
//   production  plan-prod                  read-only: classify what would change (needs PROD_DATABASE_URL).
//               approve-prod               you review the plan and type its id; writes schema-approvals/<id>.json.
//               gate-prod                  deploy.sh, before building: in sync, or an approval exists — else stop.
//               release                    runs INSIDE the image as Fly's release_command, before the new version goes
//                                          live, with the app's own DATABASE_URL: applies the plan only if an approval for
//                                          that exact SQL exists, atomically; otherwise fails and the deploy is aborted.
//
// The DB URL travels in the environment only — never on a command line or in output.
const { spawnSync } = require('node:child_process');
const readline = require('node:readline');
const { buildPlan, formatPlan } = require('./lib/schema-plan');
const approvals = require('./lib/approvals');

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

/** Neon: the pooled endpoint and the direct one are the same compute; schema work wants the direct one. */
function toDirect(url) {
  return url.replace(/-pooler(\.)/, '$1');
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace('-pooler', '');
  } catch {
    return '';
  }
}

function prisma(args, url, input) {
  return spawnSync('npx', ['prisma', ...args], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
    input,
  });
}

function diff(url, extra = []) {
  return prisma(['migrate', 'diff', '--from-schema-datasource', schemaPath, '--to-schema-datamodel', schemaPath, ...extra], url);
}

function lastLines(r, n = 6) {
  return (r.stderr || r.stdout || '').trim().split('\n').slice(-n).join('\n');
}

/** What Prisma would run to bring the DB in line with the schema, as a classified plan. */
function planFor(url, label) {
  const r = diff(url, ['--script']);
  if (r.status !== 0) fail(`Could not compare ${label}:\n${lastLines(r)}`);
  return buildPlan(r.stdout);
}

/** Best-effort, read-only row counts for the tables a plan touches (helps judge "how much data is affected"). */
async function rowCounts(url, tables) {
  const counts = {};
  try {
    const { PrismaClient } = require('@prisma/client');
    const client = new PrismaClient({ datasourceUrl: url });
    try {
      for (const t of tables) {
        if (!/^[A-Za-z0-9_]+$/.test(t)) continue; // identifiers only — never interpolate anything else
        try {
          const rows = await client.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`);
          counts[t] = rows[0].n;
        } catch {
          /* table does not exist yet — a new table has no rows to count */
        }
      }
    } finally {
      await client.$disconnect();
    }
  } catch {
    /* counts are optional */
  }
  return counts;
}

function check(url, label) {
  console.log(`Comparing ${schemaPath} with ${label}: ${describeTarget(url)}`);
  // Plan-based (not a bare exit code) so that kept backup tables from approved fixes never count as drift.
  const plan = planFor(url, label);
  if (plan.empty) {
    console.log(`✔ ${label} is in sync with the schema.`);
    return;
  }
  console.error(`\n${formatPlan(plan, { label })}\n`);
  const how =
    label === 'production'
      ? 'Deploying would ship code that expects tables/columns production does not have. Review the plan, then `npm run schema:approve:prod`.'
      : label === 'the development DB'
        ? 'Run `npm run schema:dev:push` to update the development DB.'
        : 'Run `npm run schema:test:push` to update the test DB.';
  fail(`${label} is NOT in sync with ${schemaPath}. ${how}`);
}

function push(url, label, extraArgs = []) {
  console.log(`Applying ${schemaPath} to ${label}: ${describeTarget(url)}`);
  const r = prisma(['db', 'push', '--skip-generate', '--schema', schemaPath, ...extraArgs], url);
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    fail(
      `The push to ${label} failed — most likely a change that could lose data. ` +
        (label === 'the development DB'
          ? 'Run `npm run schema:plan:dev` to see what it is; if the dev data is disposable: SCHEMA_ACCEPT_DATA_LOSS=1 npm run schema:dev:push.'
          : 'Look at it manually.'),
    );
  }
}

function requireDevEnv() {
  const url = process.env.DATABASE_URL || '';
  if (process.env.APP_ENV !== 'development') return { skip: 'APP_ENV is not "development"' };
  if (!url) return { skip: 'DATABASE_URL is not set' };
  const prod = process.env.PROD_DATABASE_URL;
  if (prod && hostOf(prod) === hostOf(url)) return { fatal: 'DATABASE_URL has the same host as PROD_DATABASE_URL — that is production, not development.' };
  return { url: toDirect(url) };
}

function requireProdUrl() {
  const url = process.env.PROD_DATABASE_URL || '';
  if (!url) {
    fail(
      'PROD_DATABASE_URL is not set. The production URL is deliberately NOT in backend/.env (that is the development DB). ' +
        'Provide it only for this command, e.g. `PROD_DATABASE_URL=… npm run schema:plan:prod`.',
    );
  }
  let local = false;
  try {
    local = ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
  } catch {
    /* an unparseable URL is reported by prisma */
  }
  if (local && !allowLocal) fail('PROD_DATABASE_URL points at localhost — that is not production, so this would prove nothing.');
  if (process.env.DATABASE_URL && process.env.APP_ENV === 'development' && hostOf(process.env.DATABASE_URL) === hostOf(url)) {
    fail('PROD_DATABASE_URL has the same host as the development DATABASE_URL — check which one you copied.');
  }
  return toDirect(url);
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (mode === 'push-test' || mode === 'check-test') {
    const url = process.env.DATABASE_URL || '';
    if (!isIsolatedTestDb(url) && !allowLocal) {
      fail('Refusing: DATABASE_URL is not the isolated test DB (localhost:5433). Run this through the npm script, which loads backend/.env.test.');
    }
    if (mode === 'check-test') check(url, 'the test DB');
    else push(url, 'the test DB');
    return;
  }

  if (mode === 'push-dev' || mode === 'check-dev' || mode === 'plan-dev') {
    const dev = requireDevEnv();
    if (dev.fatal) fail(dev.fatal);
    if (dev.skip) {
      // plan-dev feeds an editor hook: stay quiet and harmless when this machine is not set up for development yet.
      if (mode === 'plan-dev') return console.log(`(dev plan skipped: ${dev.skip}. Run \`npm run env:set-dev-db\` to enable it.)`);
      fail(
        `Refusing: ${dev.skip}. Point backend/.env at the development database with \`npm run env:set-dev-db\` ` +
          '(or set APP_ENV=development next to DATABASE_URL).',
      );
    }
    if (mode === 'check-dev') check(dev.url, 'the development DB');
    else if (mode === 'push-dev') push(dev.url, 'the development DB', process.env.SCHEMA_ACCEPT_DATA_LOSS === '1' ? ['--accept-data-loss'] : []);
    else {
      const plan = planFor(dev.url, 'the development DB');
      console.log(formatPlan(plan, { label: 'the development DB', counts: plan.empty ? null : await rowCounts(dev.url, plan.tables) }));
      if (!plan.empty) {
        console.log(
          '\nNote: this is the plan against the DEVELOPMENT database. Production may differ — the plan that counts is\n' +
            '`PROD_DATABASE_URL=… npm run schema:plan:prod` (run by you before deploying).',
        );
      }
    }
    return;
  }

  if (mode === 'plan-prod') {
    const url = requireProdUrl();
    const plan = planFor(url, 'production');
    console.log(formatPlan(plan, { label: 'production', counts: plan.empty ? null : await rowCounts(url, plan.tables) }));
    if (!plan.empty) {
      const pre = approvals.readPreFix(plan);
      console.log(
        `\nNext: if a fix is needed, write it to backend/schema-fixes/${approvals.short(plan.hash)}.pre.sql (it runs first, in the same\n` +
          'transaction, and must have no <placeholders> left). Then `npm run schema:approve:prod` and commit the approval.' +
          (pre ? `\nA fix draft already exists for this plan id (${pre.split('\n').length} line(s)).` : ''),
      );
    }
    return;
  }

  if (mode === 'approve-prod') {
    const url = requireProdUrl();
    const plan = planFor(url, 'production');
    if (plan.empty) return console.log('✔ production is already in sync — nothing to approve.');
    const counts = await rowCounts(url, plan.tables);
    console.log(formatPlan(plan, { label: 'production', counts }));
    const pre = approvals.readPreFix(plan);
    const left = approvals.unresolvedPlaceholders(pre);
    if (left.length) fail(`The fix draft still has unresolved placeholders (${[...new Set(left)].join(', ')}). Finish it, then approve.`);
    console.log(`\n${pre ? `Reviewed pre-step that will run FIRST (schema-fixes/${approvals.short(plan.hash)}.pre.sql):\n\n${pre}\n` : 'No pre-step (fix) for this plan.\n'}`);
    const phrase = `APPLY ${approvals.short(plan.hash)}`;
    const answer = process.env.SCHEMA_APPROVE_CONFIRM || (await ask(`Approving applies exactly the SQL above to production at the next deploy.\nType "${phrase}" to approve, anything else cancels: `));
    if (answer !== phrase) fail('Not approved — nothing written.');
    const file = approvals.writeApproval(plan, { pre });
    console.log(`\n✔ Approval written: ${file}\n  Commit it. The next deploy's release step will apply exactly this, atomically, and nothing else.`);
    return;
  }

  if (mode === 'gate-prod') {
    // deploy.sh, before building: do not even start a deploy that the release step will refuse.
    const url = requireProdUrl();
    console.log('Production gate — comparing the live DB with the schema (read-only).');
    const plan = planFor(url, 'production');
    if (plan.empty) return console.log('✔ production is in sync with the schema.');
    if (approvals.findApproval(plan)) {
      return console.log(`✔ production is behind the schema by ${plan.statements.length} statement(s), and plan ${approvals.short(plan.hash)} is APPROVED — the release step will apply it.`);
    }
    console.error(`\n${formatPlan(plan, { label: 'production' })}\n`);
    fail(`production is behind the schema and this change is NOT approved. Review it, then \`npm run schema:approve:prod\`, commit the approval and deploy again.`);
    return;
  }

  if (mode === 'release') {
    // Fly release_command: runs in the NEW image, before the new version serves traffic. Uses the app's own DATABASE_URL.
    const url = process.env.DATABASE_URL || '';
    if (!url) fail('release: DATABASE_URL is not set in the release environment.');
    const direct = toDirect(url);
    console.log(`Release: checking ${describeTarget(direct)} against the schema in this image.`);
    const plan = planFor(direct, 'the database');
    if (plan.empty) return console.log('✔ database is in sync — nothing to apply.');
    const approval = approvals.findApproval(plan);
    if (!approval) {
      console.error(`\n${formatPlan(plan, { label: 'the database' })}\n`);
      fail(
        `NOT APPROVED — plan ${approvals.short(plan.hash)} has no approval in this image, so the deploy is stopped before the new version goes live. ` +
          'Run `PROD_DATABASE_URL=… npm run schema:plan:prod`, review, `npm run schema:approve:prod`, commit the approval, deploy again.',
      );
    }
    console.log(`Plan ${approvals.short(plan.hash)} is approved by ${approval.approvedBy} (${approval.approvedAt}). Applying atomically…`);
    const r = prisma(['db', 'execute', '--stdin', '--schema', schemaPath], direct, approvals.buildApplyScript(plan, approval));
    process.stdout.write(r.stdout || '');
    if (r.status !== 0) fail(`Applying the approved plan failed — nothing was changed (single transaction):\n${lastLines(r, 10)}`);
    const after = planFor(direct, 'the database');
    if (!after.empty) {
      console.error(`\n${formatPlan(after, { label: 'the database (after applying)' })}\n`);
      fail('The approved plan ran, but the database still differs from the schema — stopping the deploy; investigate before retrying.');
    }
    console.log('✔ approved plan applied; database now matches the schema.');
    return;
  }

  if (mode === 'check-prod') {
    check(requireProdUrl(), 'production');
    return;
  }

  fail('Usage: node scripts/schema-sync.js <push-test|check-test|push-dev|check-dev|plan-dev|plan-prod|approve-prod|gate-prod|release|check-prod>');
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
