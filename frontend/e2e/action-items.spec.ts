import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

// Feature 16 (product-backlog/16-action-items.md §16.3): the retro loop end to end — a comment
// becomes a task with two owners, one owner sees it on the dashboard, it tops the NEXT sprint's
// board, and closing it there removes it from every "open" list.

const BACKEND_URL = 'http://localhost:5006';
// Team creation only accepts a hardcoded approver allowlist (backend/src/teams/teams.service.ts)
// — safe to use here since this suite only ever runs against the isolated test database.
const APPROVER_EMAIL = 'naveyadai@gmail.com';
const DAY = 24 * 60 * 60 * 1000;

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

test.describe('Action items', () => {
  test('comment -> task with two owners -> dashboard -> next sprint strip -> done', async ({ page, request }) => {
    // Five full page loads against the Metro dev server — past the 30s default.
    test.setTimeout(120_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E ActionItems Team ${suffix}`;
    const leaderName = `e2e_pw_ai_leader_${suffix}`;
    const memberName = `e2e_pw_ai_member_${suffix}`;
    const taskTitle = `Speed up the test runs ${suffix}`;

    // --- Setup via direct API calls ---
    const leader = await registerAndLogin(request, leaderName, `${leaderName}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_ai_approver_${suffix}`);
    const member = await registerAndLogin(request, memberName, `${memberName}@example.com`);
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    const team = await (await request.post(`${BACKEND_URL}/teams`, {
      headers: auth(leader.token),
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    })).json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver.token) });

    const membership = await (await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: auth(leader.token),
      data: { username: memberName, role: 'DEVELOPER' },
    })).json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, { headers: auth(member.token) });

    const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
    const sprintFor = async (name: string, from: number, to: number) =>
      (await (await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
        headers: auth(leader.token),
        data: { name, startDate: day(from), endDate: day(to) },
      })).json()).id as number;
    const firstSprint = await sprintFor(`E2E AI Sprint 1 ${suffix}`, -28, -15);
    const nextSprint = await sprintFor(`E2E AI Sprint 2 ${suffix}`, -14, 0);

    await request.post(`${BACKEND_URL}/sprints/${firstSprint}/comments`, {
      headers: auth(leader.token),
      data: { content: 'Tests are too slow.', type: 'IMPROVE', isAnonymous: true },
    });

    // --- Leader: turn the comment into a task, owned by both people ---
    await loginAndGoto(page, leader.token, `/team/${team.id}/sprint/${firstSprint}`);
    await expect(page.getByText('Tests are too slow.')).toBeVisible();
    await page.getByRole('button', { name: Strings.actionItems.makeTaskButton }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(Strings.actionItems.formCreateTitle)).toBeVisible();
    // (MUI's multiline input also renders a hidden sizing textarea — address the real one by placeholder.)
    const titleInput = dialog.getByPlaceholder(Strings.actionItems.titlePlaceholder);
    await expect(titleInput).toHaveValue('Tests are too slow.');
    await titleInput.fill(taskTitle);
    await dialog.getByRole('button', { name: leaderName }).click();
    await dialog.getByRole('button', { name: memberName }).click();
    await dialog.getByRole('button', { name: Strings.actionItems.createButton }).click();

    // The panel opens by itself and lists the new task with both owners.
    const row = page.getByTestId('action-item-row');
    await expect(row).toBeVisible();
    await expect(row).toContainText(taskTitle);
    await expect(row).toContainText(leaderName);
    await expect(row).toContainText(memberName);
    // Phone-width check (UI-GUIDELINES §11): the new section never makes the page scroll sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    // --- Member: sees it on the dashboard ("המשימות שלי") ---
    await loginAndGoto(page, member.token, '/');
    await expect(page.getByText(Strings.actionItems.myTasksTitle)).toBeVisible();
    await expect(page.getByTestId('my-action-item').filter({ hasText: taskTitle })).toBeVisible();

    // --- Next sprint's board: it tops the page as an open task from the previous retro ---
    await loginAndGoto(page, member.token, `/team/${team.id}/sprint/${nextSprint}`);
    await expect(page.getByText(Strings.actionItems.previousTitle)).toBeVisible();
    const previous = page.getByTestId('previous-action-item').filter({ hasText: taskTitle });
    await expect(previous).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    // --- Mark it done: gone from the strip and from the dashboard ---
    await previous.getByRole('button', { name: Strings.actionItems.markDoneButton }).click();
    await expect(page.getByText(Strings.actionItems.previousTitle)).toHaveCount(0);
    await expect(page.getByText(taskTitle)).toHaveCount(0);

    await loginAndGoto(page, member.token, '/');
    await page.getByText(teamName).waitFor();
    await expect(page.getByText(Strings.actionItems.myTasksTitle)).toHaveCount(0);
  });
});
