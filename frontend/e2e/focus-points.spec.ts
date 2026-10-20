import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';
import { openSprintTools } from './sprint-actions-ui';

// Feature 20 (product-backlog/20-issue-tracking.md §20.3): a member proposes a point, the team
// leader turns it into a point and picks it for the sprint, members rate it anonymously, the leader
// closes the window and sees the score — which a regular member never does.

const BACKEND_URL = 'http://localhost:5006';
// Team creation only accepts a hardcoded approver allowlist (backend/src/teams/teams.service.ts)
// — safe to use here since this suite only ever runs against the isolated test database.
const APPROVER_EMAIL = 'naveyadai@gmail.com';
const DAY = 24 * 60 * 60 * 1000;
const S = Strings.focusPoints;

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, { data: { username, email, password: 'password123' } });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

// Every project/test in a suite run shares the fixed approver account: the first registers it,
// the rest just log in (the backend accepts an email in the username field).
async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) {
    const body = await registerRes.json();
    return { token: body.accessToken as string, id: body.user.id as number };
  }
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  const body = await loginRes.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

/** Sets the token and lands on `path` — a full page load, so it works from any previous URL. */
async function loginAndGoto(page: Page, token: string, path = '/') {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.goto(path);
}

test.describe('Focus points', () => {
  test('member proposes -> leader creates + selects -> members rate -> leader closes and sees the score', async ({ page, request }) => {
    // Several full page loads against the Metro dev server — past the 30s default.
    test.setTimeout(180_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E FocusPoints Team ${suffix}`;
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
    const comment = `Tests are too slow ${suffix}`;

    // --- Setup via direct API calls: a leader and three plain members (4 humans: enough for scores) ---
    const leader = await registerAndLogin(request, `e2e_pw_fp_leader_${suffix}`, `e2e_pw_fp_leader_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_fp_approver_${suffix}`);
    const members: { token: string; id: number; name: string }[] = [];
    for (const n of ['a', 'b', 'c']) {
      const name = `e2e_pw_fp_${n}_${suffix}`;
      members.push({ ...(await registerAndLogin(request, name, `${name}@example.com`)), name });
    }

    const team = await (await request.post(`${BACKEND_URL}/teams`, { headers: auth(leader.token), data: { name: teamName, approverEmail: APPROVER_EMAIL } })).json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver.token) });
    for (const m of members) {
      const membership = await (await request.post(`${BACKEND_URL}/teams/${team.id}/members`, { headers: auth(leader.token), data: { username: m.name, role: 'DEVELOPER' } })).json();
      await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, { headers: auth(m.token) });
    }

    const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
    const sprint = (await (await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: auth(leader.token), data: { name: `E2E FP Sprint ${suffix}`, startDate: day(-28), endDate: day(-15) },
    })).json()).id as number;
    await request.post(`${BACKEND_URL}/sprints/${sprint}/comments`, { headers: auth(members[0].token), data: { content: comment, type: 'IMPROVE' } });

    // --- Member: "הצע כנקודה" on the comment; a second tap is not offered ---
    await loginAndGoto(page, members[0].token, `/team/${team.id}/sprint/${sprint}`);
    await expect(page.getByText(comment)).toBeVisible();
    await page.getByRole('button', { name: S.proposeButton }).click();
    await expect(page.getByText(S.proposedBadge)).toBeVisible();
    // a plain member has no entrance to the management space (the tools row is open so the absence means something)
    await openSprintTools(page);
    await expect(page.getByRole('button', { name: S.openButton })).toHaveCount(0);

    // --- Leader: opens the management space, sees the proposal as a count, creates the point ---
    await loginAndGoto(page, leader.token, `/team/${team.id}/sprint/${sprint}`);
    await openSprintTools(page);
    await page.getByRole('button', { name: S.openButton }).click();
    await expect(page.getByText(S.pageTitle).first()).toBeVisible();
    const proposal = page.getByTestId('focus-point-proposal').filter({ hasText: comment });
    await expect(proposal).toBeVisible();
    await expect(proposal).toContainText(S.proposerCount(1));
    await expect(proposal).not.toContainText(members[0].name);
    await proposal.getByRole('button', { name: S.createFromProposal }).click();
    await page.getByRole('button', { name: S.createButton }).click();

    const card = page.getByTestId('focus-point-card').filter({ hasText: comment });
    await expect(card).toBeVisible();
    await expect(page.getByTestId('focus-point-proposal')).toHaveCount(0);
    await card.getByRole('button', { name: S.selectForSprint, exact: true }).click();
    await expect(page.getByText(S.selectedCount(1, 3))).toBeVisible();
    await expect(page.getByText(S.windowOpen)).toBeVisible();

    // --- Members rate (one through the UI, the rest by API): anonymous, 1-5 ---
    await loginAndGoto(page, members[0].token, `/team/${team.id}/sprint/${sprint}`);
    const row = page.getByTestId('sprint-focus-point').filter({ hasText: comment });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText(/ציון|ממוצע/);
    await row.getByText('5 — מצוין').click();
    await row.getByRole('button', { name: S.boardSaveRating }).click();
    await expect(row.getByText(S.boardRateSaved)).toBeVisible();
    const point = (await (await request.get(`${BACKEND_URL}/teams/${team.id}/focus-points`, { headers: auth(leader.token) })).json()).points[0];
    for (const t of [members[1].token, members[2].token, leader.token]) {
      const res = await request.put(`${BACKEND_URL}/focus-points/${point.id}/rating`, { headers: auth(t), data: { sprintId: sprint, score: 5 } });
      expect(res.ok()).toBeTruthy();
    }

    // --- Leader closes the window and sees the result; 4 x 5 = average 5 -> the point closes ---
    await loginAndGoto(page, leader.token, `/team/${team.id}/focus-points`);
    await page.getByRole('button', { name: S.closeWindowButton }).click();
    await page.getByRole('button', { name: S.closeWindowConfirmButton }).click();
    await expect(page.getByText(S.closeWindowDone, { exact: false })).toBeVisible();
    const closedCard = page.getByTestId('focus-point-card').filter({ hasText: comment });
    await expect(closedCard).toContainText(S.statusClosed);
    await expect(closedCard).toContainText(S.ratersCount(4));
    await expect(closedCard).toContainText(S.trendImproved);
    // phone width: the management screen never scrolls sideways (UI-GUIDELINES §11)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    // --- A regular member opening the management route directly gets nothing (403 from the API) ---
    await loginAndGoto(page, members[0].token, `/team/${team.id}/focus-points`);
    await expect(page.getByText(S.loadError)).toBeVisible();
    await expect(page.getByTestId('focus-point-card')).toHaveCount(0);
  });
});
