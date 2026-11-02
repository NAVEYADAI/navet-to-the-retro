#!/usr/bin/env node
// env:check — reports what is wrong with the local environment, BEFORE anything is enforced.
//   npm run env:check            (from the repo root or from backend/)
// It reads the .env files itself but prints NAMES and verdicts only — never a value. The only thing printed about a
// database is its Neon endpoint id (not a secret) and whether it is the development or the production branch.
// Exit code 1 when something is wrong (errors); warnings do not fail it.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const policy = require('./env-policy.json');

// What each file must / may define. Source of truth: backend/.env.example, frontend/.env.example, docker-compose.yml.
const SPEC = {
  '.env': {
    role: 'docker-compose (repo root)',
    required: ['APP_ENV', 'DATABASE_URL', 'JWT_SECRET'],
    optional: ['RESEND_API_KEY', 'FRONTEND_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_LOGIN_REDIRECT_URI', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'BACKEND_URL', 'EXPO_PUBLIC_BACKEND_URL_PROD'],
  },
  'backend/.env': {
    role: 'backend server + schema scripts',
    required: ['APP_ENV', 'DATABASE_URL', 'JWT_SECRET'],
    optional: ['RESEND_API_KEY', 'EMAIL_FROM', 'FRONTEND_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'BACKEND_URL', 'SMTP_USER', 'SMTP_PASS'],
  },
  'frontend/.env': {
    role: 'frontend',
    required: [],
    optional: ['EXPO_PUBLIC_BACKEND_URL_PROD', 'EXPO_PUBLIC_PORT', 'EXPO_PUBLIC_POSTHOG_HOST', 'EXPO_PUBLIC_POSTHOG_KEY', 'EXPO_PUBLIC_TELEGRAM_BOT_USERNAME'],
  },
  'backend/.env.test': {
    role: 'isolated tests (postgres-test)',
    required: ['DATABASE_URL', 'BACKEND_PORT', 'JWT_SECRET'],
    optional: ['BACKEND_URL', 'RESEND_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'],
  },
};

// docker-compose passes these through from the root .env to the dev backend container.
const COMPOSE_KEYS = ['DATABASE_URL', 'APP_ENV', 'JWT_SECRET', 'RESEND_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_LOGIN_REDIRECT_URI', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'BACKEND_URL', 'EXPO_PUBLIC_BACKEND_URL_PROD'];

function parseEnv(text) {
  const map = new Map();
  for (const raw of String(text || '').split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!m || raw.trimStart().startsWith('#')) continue;
    map.set(m[1], m[2].trim().replace(/^(['"])(.*)\1$/, '$2'));
  }
  return map;
}

function parseUrl(value) {
  try {
    const u = new URL(value);
    return { host: u.hostname, port: u.port, protocol: u.protocol };
  } catch {
    return null;
  }
}

/** 'development' | 'production' | 'test' | 'unknown' | 'invalid' — by the endpoint id only, never by credentials. */
function classifyDb(value, pol = policy) {
  const u = parseUrl(value);
  if (!u) return { kind: 'invalid' };
  const id = u.host.replace(/-pooler/, '').split('.')[0];
  if (pol.productionHosts.includes(id)) return { kind: 'production', id };
  if (pol.developmentHosts.includes(id)) return { kind: 'development', id };
  if ((u.host === 'localhost' || u.host === '127.0.0.1') && u.port === '5433') return { kind: 'test', id: `${u.host}:${u.port}` };
  return { kind: 'unknown', id: u.host.endsWith('.neon.tech') ? id : u.host };
}

/**
 * Pure: ctx = { files: { [relPath]: { text: string|null, mode?: number } }, ignored: Set<relPath>, policy?, container?: {appEnv, host}|null }
 * Returns [{ level: 'ok'|'warn'|'error', area, message, fix? }] — messages contain names and verdicts only.
 */
function checkEnv(ctx) {
  const pol = ctx.policy || policy;
  const out = [];
  const add = (level, area, message, fix) => out.push({ level, area, message, ...(fix ? { fix } : {}) });
  const parsed = {};

  for (const [file, spec] of Object.entries(SPEC)) {
    const f = ctx.files[file];
    if (!f || f.text == null) {
      add(file === 'frontend/.env' ? 'warn' : 'error', file, `missing (${spec.role})`, 'Create it from its .env.example / ENV-SETUP.md; ask Nave for values — never invent them.');
      continue;
    }
    const env = (parsed[file] = parseEnv(f.text));
    if (!ctx.ignored.has(file)) add('error', file, 'is NOT ignored by git — never commit it', 'Add it to .gitignore before any commit.');
    if (f.mode != null && (f.mode & 0o077) !== 0) add('warn', file, 'is readable by other users (should be 600)', `chmod 600 ${file}`);

    const empty = spec.required.filter((k) => !env.has(k) || env.get(k) === '');
    if (empty.length) add('error', file, `required but missing/empty: ${empty.join(', ')}`);
    else if (spec.required.length) add('ok', file, `required keys present (${spec.required.join(', ')})`);
    const optMissing = spec.optional.filter((k) => !env.has(k) || env.get(k) === '');
    if (optMissing.length) add('warn', file, `optional, not set: ${optMissing.join(', ')}`);
    const unknown = [...env.keys()].filter((k) => !spec.required.includes(k) && !spec.optional.includes(k));
    if (unknown.length) add('warn', file, `keys not in the checker's list (new variable? add it to scripts/env-check.js): ${unknown.join(', ')}`);
  }

  // Development files must say development and point at the development database.
  const devFiles = ['.env', 'backend/.env'].filter((f) => parsed[f]);
  for (const file of devFiles) {
    const env = parsed[file];
    const appEnv = env.get('APP_ENV');
    if (appEnv && appEnv !== 'development') add('error', file, `APP_ENV is "${appEnv}" — must be "development" on this machine`);
    const url = env.get('DATABASE_URL');
    if (url) {
      const c = classifyDb(url, pol);
      if (c.kind === 'production') add('error', file, `DATABASE_URL points at the PRODUCTION database (${c.id})`, 'Switch to the development branch: Nave runs `npm run env:set-dev-db --prefix backend` in his own terminal. Production lives only in Fly secrets.');
      else if (c.kind === 'development') add('ok', file, `DATABASE_URL points at the development database (${c.id})`);
      else if (c.kind === 'test') add('error', file, 'DATABASE_URL points at the test database — the dev server must use the development branch');
      else if (c.kind === 'invalid') add('error', file, 'DATABASE_URL is not a valid URL');
      else add('warn', file, `DATABASE_URL points at an unknown host (${c.id}) — add it to developmentHosts in scripts/env-policy.json if it is the development branch`);
    }
  }

  // The two dev files must agree.
  if (parsed['.env'] && parsed['backend/.env']) {
    const a = parsed['.env'].get('DATABASE_URL');
    const b = parsed['backend/.env'].get('DATABASE_URL');
    if (a && b) {
      const ha = classifyDb(a, pol), hb = classifyDb(b, pol);
      if (ha.id !== hb.id) add('error', '.env vs backend/.env', 'DATABASE_URL points at different databases (compose and the schema scripts would disagree)');
    }
    const ja = parsed['.env'].get('JWT_SECRET'), jb = parsed['backend/.env'].get('JWT_SECRET');
    if (ja && jb && ja !== jb) add('warn', '.env vs backend/.env', 'JWT_SECRET differs between the two files');
  }

  // Compose passes these through — an unset one reaches the container as empty.
  if (parsed['.env']) {
    const missing = COMPOSE_KEYS.filter((k) => !parsed['.env'].get(k));
    if (missing.length) add('warn', '.env', `docker-compose passes these to the backend container but they are empty: ${missing.join(', ')}`);
  }

  // Tests must only ever touch the local test database.
  if (parsed['backend/.env.test']) {
    const env = parsed['backend/.env.test'];
    const c = env.get('DATABASE_URL') ? classifyDb(env.get('DATABASE_URL'), pol) : null;
    if (c && c.kind !== 'test') add('error', 'backend/.env.test', `DATABASE_URL must be the local test DB (localhost:5433) — it is "${c.kind}"`);
    else if (c) add('ok', 'backend/.env.test', 'DATABASE_URL is the local test database');
    if (env.get('BACKEND_PORT') && env.get('BACKEND_PORT') !== '5006') add('error', 'backend/.env.test', 'BACKEND_PORT must be 5006 (5005 is the dev backend)');
  }

  // What the running dev container actually loaded (the files are not enough — compose reads them at create time).
  if (ctx.container === undefined) {
    // not probed
  } else if (ctx.container === null) {
    add('warn', 'dev container', `${pol.devContainer} is not running — nothing to compare`);
  } else {
    const c = classifyDb(`postgresql://x@${ctx.container.host || 'invalid'}/x`, pol);
    if (ctx.container.appEnv !== 'development') add('error', 'dev container', `running with APP_ENV="${ctx.container.appEnv || '(unset)'}"`, 'Recreate it after fixing the env: docker compose up -d --force-recreate backend');
    if (c.kind === 'production') add('error', 'dev container', `is connected to the PRODUCTION database (${c.id})`, 'Fix the env files, then: docker compose up -d --force-recreate backend');
    else if (c.kind === 'development') add('ok', 'dev container', `APP_ENV=development, connected to the development database (${c.id})`);
    else add('warn', 'dev container', `connected to an unknown host (${c.id})`);
  }

  return out;
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function gather({ probeContainer = true } = {}) {
  const files = {};
  const ignored = new Set();
  for (const rel of Object.keys(SPEC)) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) files[rel] = { text: fs.readFileSync(abs, 'utf8'), mode: fs.statSync(abs).mode & 0o777 };
    else files[rel] = { text: null };
    const ig = cp.spawnSync('git', ['check-ignore', '-q', rel], { cwd: ROOT });
    if (ig.status === 0) ignored.add(rel);
  }
  let container;
  if (!probeContainer) return { files, ignored, container };
  const probe = cp.spawnSync(
    'docker',
    ['exec', policy.devContainer, 'node', '-e', "let h='';try{h=new URL(process.env.DATABASE_URL||'').hostname}catch{};console.log(JSON.stringify({appEnv:process.env.APP_ENV||'',host:h}))"],
    { encoding: 'utf8' },
  );
  if (probe.error || probe.status === 127) container = undefined; // docker not available: skip
  else if (probe.status !== 0) container = null;
  else {
    try { container = JSON.parse(probe.stdout.trim().split('\n').pop()); } catch { container = undefined; }
  }
  return { files, ignored, container };
}

function main() {
  // --gate: the preflight that DB-touching npm scripts run first (e.g. migrate:dev). Files only (no docker probe), silent
  // when everything is fine, and it stops the script (exit 1) when the environment has an error.
  const gate = process.argv.includes('--gate');
  const results = checkEnv(gather({ probeContainer: !gate }));
  const icon = { ok: '✔', warn: '⚠', error: '✖' };
  if (gate && !results.some((r) => r.level === 'error')) return;
  console.log(`\n${gate ? 'env:check (preflight) — stopped before touching any database' : 'env:check'} — names and verdicts only, no values are ever printed\n`);
  for (const r of gate ? results.filter((x) => x.level === 'error') : results) {
    console.log(`${icon[r.level]} ${r.area}: ${r.message}`);
    if (r.fix && r.level !== 'ok') console.log(`    → ${r.fix}`);
  }
  const errors = results.filter((r) => r.level === 'error').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  console.log(`\n${errors ? '✖' : '✔'} ${errors} error(s), ${warns} warning(s)${errors ? ' — fix the errors, then run it again (full report: npm run env:check).' : '.'}\n`);
  process.exit(errors ? 1 : 0);
}

if (require.main === module) main();
module.exports = { parseEnv, classifyDb, checkEnv, SPEC };
