import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

// Feature 21 (product-backlog/21-onboarding-and-feature-discovery.md §21.3): the dashboard starter
// checklist (two tracks: management / member), the one-at-a-time "what's new" card that only team
// management gets for improvement points, and the persistence of hiding / closing (stored per user on
// the server, so it survives a reload).

const BACKEND_URL = 'http://localhost:5006';
// Team creation only accepts a hardcoded approver allowlist (backend/src/teams/teams.service.ts)
// — safe to use here since this suite only ever runs against the isolated test database.
const APPROVER_EMAIL = 'lironka13@gmail.com';
const DAY = 24 * 60 * 60 * 1000;
const S = Strings.onboarding;
const FP = S.features['focus-points'];

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function register(request: APIRequestContext, username: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, { data: { username, email: `${username}@example.com`, password: 'password123' } });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number, username };
}

// The approver allowlist is a fixed real email, so every project/spec in one run shares the same
// account — register once, log in after.
async function approverToken(request: APIRequestContext, usernameIfNew: string) {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) return (await registerRes.json()).accessToken as string;
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  return (await loginRes.json()).accessToken as string;
}

async function approvedTeam(request: APIRequestContext, leaderToken: string, name: string, approver: string) {
  const team = await (await request.post(`${BACKEND_URL}/teams`, { headers: auth(leaderToken), data: { name, approverEmail: APPROVER_EMAIL } })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver) });
  return team as { id: number };
}

async function joinViaInvite(request: APIRequestContext, teamId: number, leaderToken: string, memberToken: string) {
  const invite = await (await request.post(`${BACKEND_URL}/teams/${teamId}/invites`, { headers: auth(leaderToken), data: {} })).json();
  const res = await request.post(`${BACKEND_URL}/invites/${invite.token}/consume`, { headers: auth(memberToken) });
  expect(res.ok()).toBeTruthy();
}

/** Sets the token and lands on `path` — a full page load, so it works from any previous URL. */
async function loginAndGoto(page: Page, token: string, path = '/') {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.goto(path);
}

// "Absent" assertions are only meaningful once the status request has come back, so these wait for it.
const isStatus = (r: { url(): string }) => r.url().includes('/onboarding/status');
async function reloadSettled(page: Page) {
  await Promise.all([page.waitForResponse(isStatus), page.reload()]);
}
async function gotoDashboardSettled(page: Page) {
  await Promise.all([page.waitForResponse(isStatus), page.goto('/')]);
}

const checklist = (page: Page) => page.getByTestId('onboarding-checklist');
const step = (page: Page, key: string) => page.locator(`[data-testid="onboarding-step"][data-step-key="${key}"]`);
const whatsNew = (page: Page) => page.getByTestId('whats-new-card');
const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe('Onboarding — checklist and what\'s new', () => {
  test('a brand-new user sees the management checklist; hiding it sticks across reloads and "הצג שוב" in settings brings it back', async ({ page, request }) => {
    test.setTimeout(180_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_new`;
    const user = await register(request, `e2e_pw_ob_new_${suffix}`);

    await loginAndGoto(page, user.token);
    await expect(checklist(page)).toBeVisible();
    await expect(checklist(page)).toContainText(S.checklistTitle);
    await expect(checklist(page)).toContainText(S.checklistSubtitleManagement);
    await expect(checklist(page)).toContainText(S.progress(0, 5));
    // All five management steps, none finished, in the documented order.
    await expect(page.getByTestId('onboarding-step')).toHaveCount(5);
    expect(await page.getByTestId('onboarding-step').evaluateAll((els) => els.map((e) => e.getAttribute('data-step-key'))))
      .toEqual(['create-team', 'invite-member', 'open-sprint', 'close-sprint', 'pick-focus-point']);
    await expect(page.locator('[data-testid="onboarding-step"][data-done="true"]')).toHaveCount(0);
    // A brand-new user manages nothing yet, so the management-only announcement is not for them.
    await expect(whatsNew(page)).toHaveCount(0);
    // phone width: the card never scrolls the page sideways
    expect(await noSidewaysScroll(page)).toBe(true);
    // RTL: the title block sits at the start (right) and "הסתר" at the end (left) of the header row.
    const titleBox = await checklist(page).getByRole('heading', { name: S.checklistTitle }).boundingBox();
    const hideBox = await checklist(page).getByRole('button', { name: S.hideButton }).boundingBox();
    expect(titleBox!.x).toBeGreaterThan(hideBox!.x);

    // The create-team step leads straight to where teams are created.
    await step(page, 'create-team').getByRole('button', { name: S.steps['create-team'].cta! }).click();
    await expect(page).toHaveURL(/\/settings$/);
    // While the checklist is visible the settings card has no "show again" button.
    await expect(page.getByTestId('quick-start-status')).toHaveText(S.quickStartVisibleText);
    await expect(page.getByRole('button', { name: S.quickStartRestoreButton })).toHaveCount(0);

    // Hide it on the dashboard, and it stays hidden after a full reload.
    await page.goto('/');
    await checklist(page).getByRole('button', { name: S.hideButton }).click();
    await expect(checklist(page)).toHaveCount(0);
    await reloadSettled(page);
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    await expect(checklist(page)).toHaveCount(0);

    // Settings offers the way back; restoring shows it on the dashboard again.
    await page.goto('/settings');
    await expect(page.getByTestId('quick-start-status')).toHaveText(S.quickStartDismissedText);
    await page.getByRole('button', { name: S.quickStartRestoreButton }).click();
    await expect(page.getByTestId('quick-start-status')).toHaveText(S.quickStartVisibleText);
    await expect(page.getByRole('button', { name: S.quickStartRestoreButton })).toHaveCount(0);
    await page.goto('/');
    await expect(checklist(page)).toBeVisible();
  });

  test('creating a team marks the "create team" step done', async ({ page, request }) => {
    test.setTimeout(180_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_create`;
    const leader = await register(request, `e2e_pw_ob_create_${suffix}`);
    const approver = await approverToken(request, `e2e_pw_ob_approver_${suffix}`);

    await loginAndGoto(page, leader.token);
    await expect(step(page, 'create-team')).toHaveAttribute('data-done', 'false');
    await expect(checklist(page)).toContainText(S.progress(0, 5));

    // A team still waiting for approval is not progress.
    const team = await (await request.post(`${BACKEND_URL}/teams`, { headers: auth(leader.token), data: { name: `E2E OB Team ${suffix}`, approverEmail: APPROVER_EMAIL } })).json();
    await page.reload();
    await expect(step(page, 'create-team')).toHaveAttribute('data-done', 'false');

    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver) });
    await page.reload();
    await expect(step(page, 'create-team')).toHaveAttribute('data-done', 'true');
    await expect(step(page, 'create-team')).toContainText(S.stepDone);
    // a finished step collapses: no wording, no button
    await expect(step(page, 'create-team')).not.toContainText(S.steps['create-team'].description);
    await expect(step(page, 'create-team').getByRole('button')).toHaveCount(0);
    await expect(step(page, 'invite-member')).toHaveAttribute('data-done', 'false');
    await expect(checklist(page)).toContainText(S.progress(1, 5));

    // Doing real work moves the next steps on a refresh of the screen.
    await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, { headers: auth(leader.token), data: { name: `E2E OB Sprint ${suffix}`, startDate: day(-2), endDate: day(8) } });
    await page.reload();
    await expect(step(page, 'open-sprint')).toHaveAttribute('data-done', 'true');
    await expect(checklist(page)).toContainText(S.progress(2, 5));
  });

  test('an invited member gets the member track and no management announcement; the team leader gets it; closing it sticks after reload', async ({ page, request }) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_tracks`;
    const leader = await register(request, `e2e_pw_ob_lead_${suffix}`);
    const member = await register(request, `e2e_pw_ob_member_${suffix}`);
    const approver = await approverToken(request, `e2e_pw_ob_approver_${suffix}`);
    const team = await approvedTeam(request, leader.token, `E2E OB Tracks ${suffix}`, approver);
    await joinViaInvite(request, team.id, leader.token, member.token);
    const sprint = await (await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: auth(leader.token), data: { name: `E2E OB Sprint ${suffix}`, startDate: day(-2), endDate: day(8) },
    })).json();

    // --- Member: member track, joined, no comment yet, Telegram only recommended ---
    await loginAndGoto(page, member.token);
    await expect(checklist(page)).toBeVisible();
    await expect(checklist(page)).toContainText(S.checklistSubtitleMember);
    await expect(checklist(page)).not.toContainText(S.checklistSubtitleManagement);
    await expect(page.getByTestId('onboarding-step')).toHaveCount(3);
    await expect(step(page, 'join-team')).toHaveAttribute('data-done', 'true');
    await expect(step(page, 'first-comment')).toHaveAttribute('data-done', 'false');
    await expect(step(page, 'connect-telegram')).toContainText(S.stepRecommended);
    await expect(checklist(page)).toContainText(S.progress(1, 2));
    // none of the management steps exist for a plain member (absent, not just hidden)
    for (const key of ['create-team', 'invite-member', 'open-sprint', 'close-sprint', 'pick-focus-point']) {
      await expect(step(page, key)).toHaveCount(0);
    }
    // the management-only "improvement points" card is never rendered for a plain member
    await expect(whatsNew(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: FP.title })).toHaveCount(0);
    await expect(page.getByText(S.managementOnlyBadge)).toHaveCount(0);

    // The first-comment step opens the sprint that is running today (the status hints say which one).
    await step(page, 'first-comment').getByRole('button', { name: S.steps['first-comment'].cta! }).click();
    await expect(page).toHaveURL(new RegExp(`/team/${team.id}/sprint/${sprint.id}$`));
    await loginAndGoto(page, member.token);
    await expect(checklist(page)).toBeVisible();

    // The recommended Telegram step has a button that leads to the settings.
    await step(page, 'connect-telegram').getByRole('button', { name: S.steps['connect-telegram'].cta! }).click();
    await expect(page).toHaveURL(/\/settings$/);

    // Writing the first comment finishes every required step: the checklist is gone on the next load.
    const res = await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, { headers: auth(member.token), data: { content: `ob comment ${suffix}`, type: 'KEEP' } });
    expect(res.ok()).toBeTruthy();
    await gotoDashboardSettled(page);
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    await expect(checklist(page)).toHaveCount(0);
    await expect(whatsNew(page)).toHaveCount(0);

    // --- Team leader: the improvement-points card, once, management-only ---
    await loginAndGoto(page, leader.token);
    await expect(whatsNew(page)).toHaveCount(1);
    await expect(whatsNew(page)).toHaveAttribute('data-feature-key', 'focus-points');
    await expect(whatsNew(page).getByRole('heading', { name: FP.title })).toBeVisible();
    await expect(whatsNew(page)).toContainText(S.managementOnlyBadge);
    // Just seeing the card (even after a reload) does not use it up.
    await page.reload();
    await expect(whatsNew(page)).toHaveCount(1);
    expect(await noSidewaysScroll(page)).toBe(true);

    // Closing it records "seen": it does not come back after a reload, nor from another session.
    await whatsNew(page).getByRole('button', { name: S.whatsNewDismissButton }).click();
    await expect(whatsNew(page)).toHaveCount(0);
    await reloadSettled(page);
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    await expect(whatsNew(page)).toHaveCount(0);
    const status = await (await request.get(`${BACKEND_URL}/onboarding/status`, { headers: auth(leader.token) })).json();
    expect(status.unseenFeatureKeys).toEqual([]);
  });

  test('the leader\'s CTA opens the improvement points of the managed team and counts as seen', async ({ page, request }) => {
    test.setTimeout(180_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_cta`;
    const leader = await register(request, `e2e_pw_ob_cta_${suffix}`);
    const approver = await approverToken(request, `e2e_pw_ob_approver_${suffix}`);
    const team = await approvedTeam(request, leader.token, `E2E OB Cta ${suffix}`, approver);

    await loginAndGoto(page, leader.token);
    await whatsNew(page).getByRole('button', { name: FP.cta }).click();
    await expect(page).toHaveURL(new RegExp(`/team/${team.id}/focus-points$`));

    await gotoDashboardSettled(page);
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    await expect(whatsNew(page)).toHaveCount(0);
  });
});
