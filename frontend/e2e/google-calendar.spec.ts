import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { Strings } from '../src/constants/strings';

// Google Calendar personal connection (product-backlog/06-google-calendar-integration.md §6).
//
// **Stub strategy / real limitation**: a genuine OAuth round-trip against Google cannot run in an
// isolated e2e environment — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` are
// intentionally left unset in `backend/.env.test` (see that file), so `GoogleCalendarService` is
// "not configured" for the whole duration of this suite, exactly like it would be for any other
// e2e run. That means:
//   - `GET google-calendar/connect` really does 500 here (not mocked) — the first test below
//     exercises that real, unconfigured-server error path end-to-end through the actual UI click.
//   - `GET google-calendar/callback` (the real token-exchange code) is never invoked by this
//     suite at all — there is no way to simulate a redirect from Google without either a fake
//     OAuth server or mocking `googleapis` inside the running e2e backend process, neither of
//     which this suite does.
//   - To test the "connected" *display* state and the real `PATCH google-calendar/disconnect`
//     endpoint, a `GoogleCalendarConnection` row is written directly into the isolated test DB via
//     `backend/scripts/e2e-seed-google-connection.js` (Prisma, guarded to only ever run against
//     `postgres-test`) — bypassing the OAuth exchange itself, the same way the backend's own Jest
//     suite bypasses it by mocking `googleapis` (see google-calendar.service.spec.ts). This proves
//     the settings card renders/reacts to a real connection row and that disconnect really flips
//     it in the DB — it does NOT prove the token-exchange (`handleCallback`) code path works.

const BACKEND_URL = 'http://localhost:5006';
const APPROVER_EMAIL = 'lironka13@gmail.com';

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username, email, password: 'password123' },
  });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) {
    const body = await registerRes.json();
    return { token: body.accessToken as string, id: body.user.id as number };
  }
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { username: APPROVER_EMAIL, password: 'password123' },
  });
  const body = await loginRes.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

async function loginAndOpenSettings(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.goto('/settings');
  await page.getByText(Strings.settings.pageTitle).waitFor();
}

// See file header — writes a `GoogleCalendarConnection` row directly into the isolated test DB,
// standing in for a real OAuth round-trip that cannot run here.
function seedGoogleConnection(userId: number, email: string) {
  execFileSync(
    'npm',
    ['run', '--silent', 'e2e:seed-google-connection', '--', String(userId), email],
    { cwd: path.resolve(__dirname, '../../backend'), stdio: 'inherit' }
  );
}

test.describe('Google Calendar integration — settings card (product-backlog/06)', () => {
  test('a plain (non-admin) team member sees the connection card in settings, not-connected by default, and a real connect click surfaces the real server error', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E GCal Team ${suffix}`;
    const memberUsername = `e2e_pw_gcal_member_${suffix}`;

    // A team with an admin (creator) and a plain DEVELOPER member — decision 6.0.3 says the
    // connection is personal and available to *every* team member, not gated to admin/TEAM_LEADER
    // like most other per-team actions in this app. The real cross-user authorization boundary
    // (a member can only manage their *own* connection, never another's — `userId` from the
    // validated token, never a body param) is covered at the API level by
    // backend/src/google-calendar/google-calendar.controller.spec.ts.
    const admin = await registerAndLogin(request, `e2e_pw_gcal_admin_${suffix}`, `e2e_pw_gcal_admin_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_gcal_approver_${suffix}`);
    const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    const addMemberRes = await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { username: memberUsername, role: 'DEVELOPER' },
    });
    const membership = await addMemberRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });

    await loginAndOpenSettings(page, member.token);

    await expect(page.getByText(Strings.settings.googleCalendarCardTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(Strings.settings.googleCalendarNotConnectedText)).toBeVisible();
    const connectButton = page.getByRole('button', { name: Strings.settings.googleCalendarConnectButton });
    await expect(connectButton).toBeVisible();

    // GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI are unset in backend/.env.test, so this is a real
    // (unmocked) 500 from the running e2e backend, not a simulated one.
    await connectButton.click();
    await expect(page.getByText(Strings.settings.googleCalendarConnectError)).toBeVisible();
    // Still not connected — the failed attempt didn't leave the UI in a stuck/inconsistent state.
    await expect(page.getByText(Strings.settings.googleCalendarNotConnectedText)).toBeVisible();
  });

  test('a user with an existing connection (seeded — see file header) sees "connected" status and disconnecting through the real endpoint flips it back', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const username = `e2e_pw_gcal_solo_${suffix}`;
    const googleAccountEmail = `${username}_google@example.com`;

    const user = await registerAndLogin(request, username, `${username}@example.com`);
    seedGoogleConnection(user.id, googleAccountEmail);

    await loginAndOpenSettings(page, user.token);

    await expect(page.getByText(Strings.settings.googleCalendarConnectedLabel(googleAccountEmail))).toBeVisible();
    const disconnectButton = page.getByRole('button', { name: Strings.settings.googleCalendarDisconnectButton });
    await expect(disconnectButton).toBeVisible();
    // The "not connected" copy/connect button must not also be present while connected.
    await expect(page.getByText(Strings.settings.googleCalendarNotConnectedText)).toHaveCount(0);

    await disconnectButton.click();

    await expect(page.getByText(Strings.settings.googleCalendarDisconnectedMessage)).toBeVisible();
    await expect(page.getByText(Strings.settings.googleCalendarNotConnectedText)).toBeVisible();
    await expect(page.getByRole('button', { name: Strings.settings.googleCalendarDisconnectButton })).toHaveCount(0);

    // Confirm it's really persisted server-side (real endpoint, not just local state).
    const statusRes = await request.get(`${BACKEND_URL}/google-calendar/status`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(await statusRes.json()).toEqual({ connected: false });
  });
});
