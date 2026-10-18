// TEMPLATE — the mobile-check skill copies this to frontend/e2e/_mobile-check.tmp.spec.ts, fills in `screens`,
// runs it with `--project="Mobile Chrome"`, reads the report + screenshots, and DELETES the copy.
// Everything runs against the isolated e2e stack (backend 5006 / postgres-test) that playwright.config.ts starts.
import { test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BACKEND_URL = 'http://localhost:5006';
const APPROVER_EMAIL = 'naveyadai@gmail.com'; // the only allowed approver (backend/src/teams/teams.service.ts)
const PROBE = fs.readFileSync(path.join(__dirname, '../../.claude/skills/mobile-check/probe.js'), 'utf8');
// Outside the repo on purpose: stray files under frontend/ can crash the Metro watcher of the dev container.
const OUT_DIR = process.env.MOBILE_CHECK_DIR || path.join(os.tmpdir(), 'mobile-check');

// ---- helpers (same API calls the existing specs use; usernames start with e2e_pw_ so global-teardown removes them) ----
async function registerAndLogin(request: APIRequestContext, username: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username, email: `${username}@example.com`, password: 'password123' },
  });
  const body = await res.json();
  return { token: body.accessToken as string };
}

async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const reg = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (reg.ok()) return { token: (await reg.json()).accessToken as string };
  const login = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  return { token: (await login.json()).accessToken as string };
}

/** A team (approved) with one future-or-current sprint, owned by a fresh admin. Returns ids + the admin's token. */
async function seedTeamWithSprint(request: APIRequestContext, suffix: string) {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const admin = await registerAndLogin(request, `e2e_pw_mc_admin_${suffix}`);
  const approver = await ensureApprover(request, `e2e_pw_mc_approver_${suffix}`);
  const team = await (await request.post(`${BACKEND_URL}/teams`, {
    headers: auth(admin.token), data: { name: `MC Team ${suffix}`, approverEmail: APPROVER_EMAIL },
  })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver.token) });
  const today = new Date();
  const sprint = await (await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
    headers: auth(admin.token),
    data: {
      name: `MC Sprint ${suffix}`,
      startDate: today.toISOString().slice(0, 10),
      endDate: new Date(today.getTime() + 14 * 864e5).toISOString().slice(0, 10),
    },
  })).json();
  return { token: admin.token, teamId: team.id as number, sprintId: sprint.id as number, teamName: team.name as string };
}

async function signIn(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
}

// ---- the screens to check — EDIT THIS PART ----
type Seed = Awaited<ReturnType<typeof seedTeamWithSprint>>;
const screens: Array<{ name: string; open: (page: Page, seed: Seed) => Promise<void> }> = [
  // Example: the dashboard and a sprint board. Replace/extend with the screens the change touches, and perform the
  // interactions that reveal states (open a menu, expand a section, open a modal) BEFORE returning from `open`.
  { name: 'dashboard', open: async (page) => { await page.goto('/'); await page.getByText('MC Team').first().waitFor(); } },
  { name: 'sprint-board', open: async (page, s) => { await page.goto(`/team/${s.teamId}/sprint/${s.sprintId}`); await page.getByText(`MC Sprint`).first().waitFor(); } },
];

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test('mobile-check @ 375px', async ({ page, request }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const suffix = `${Date.now()}`;
  const seed = await seedTeamWithSprint(request, suffix);
  await signIn(page, seed.token);

  const report: Array<{ screen: string; screenshot: string; viewport: unknown; issues: unknown[] }> = [];
  for (const screen of screens) {
    await screen.open(page, seed);
    await page.waitForTimeout(400); // let layout settle after fonts / transitions
    await page.addScriptTag({ content: PROBE });
    const result = await page.evaluate(() => (window as any).__mobileProbe());
    const shot = path.join(OUT_DIR, `${screen.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    report.push({ screen: screen.name, screenshot: shot, viewport: result.viewport, issues: result.issues });
  }
  const file = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`MOBILE_CHECK_REPORT ${file}`);
});
