import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

// BUG-33: the retro board, sprint summary and memory game are real routes
// (/team/:teamId/sprint/:sprintId[/summary|/memory]) — URL reflects the view, F5 stays in place,
// Back goes back inside the app, links can be shared (deep link), and a sprint the user cannot
// see gets a "not found" screen instead of a blank page.

const BACKEND_URL = 'http://localhost:5006';
// Team creation only accepts a hardcoded approver allowlist (backend/src/teams/teams.service.ts)
// — safe to use here since this suite only ever runs against the isolated test database.
const APPROVER_EMAIL = 'naveyadai@gmail.com';

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username, email, password: 'password123' },
  });
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
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { username: APPROVER_EMAIL, password: 'password123' },
  });
  const body = await loginRes.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

/** Sets the token and lands on `path` — a full page load, so it works from any previous URL. */
async function loginAndGoto(page: Page, token: string, path = '/') {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.goto(path);
}

async function createTeamWithSprint(request: APIRequestContext, suffix: string, who: string) {
  const teamName = `E2E Routes Team ${who} ${suffix}`;
  const sprintName = `E2E Routes Sprint ${who} ${suffix}`;
  const leader = await registerAndLogin(request, `e2e_pw_rt_${who}_${suffix}`, `e2e_pw_rt_${who}_${suffix}@example.com`);
  const approver = await ensureApprover(request, `e2e_pw_rt_approver_${suffix}`);

  const teamRes = await request.post(`${BACKEND_URL}/teams`, {
    headers: { Authorization: `Bearer ${leader.token}` },
    data: { name: teamName, approverEmail: APPROVER_EMAIL },
  });
  const team = await teamRes.json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
    headers: { Authorization: `Bearer ${approver.token}` },
  });

  const today = new Date();
  const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const sprintRes = await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
    headers: { Authorization: `Bearer ${leader.token}` },
    data: { name: sprintName, startDate: today.toISOString().slice(0, 10), endDate: twoWeeksOut.toISOString().slice(0, 10) },
  });
  const sprint = await sprintRes.json();

  const commentContent = `Route comment ${who} ${suffix}`;
  await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
    headers: { Authorization: `Bearer ${leader.token}` },
    data: { content: commentContent, type: 'KEEP', isAnonymous: false },
  });

  return { teamName, sprintName, leader, team, sprint, commentContent };
}

const boardPath = (teamId: number, sprintId: number) => `/team/${teamId}/sprint/${sprintId}`;

test.describe('Sprint screens are real routes (BUG-33)', () => {
  test('opening a sprint changes the URL; F5 stays on the board; the in-app back button returns to the dashboard', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const { teamName, sprintName, leader, team, sprint, commentContent } = await createTeamWithSprint(request, suffix, 'a');

    await loginAndGoto(page, leader.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page).toHaveURL(new RegExp(`${boardPath(team.id, sprint.id)}$`));
    await expect(page.getByText(commentContent)).toBeVisible();

    // F5 keeps the user on the same sprint (previously it dropped back to the team list).
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${boardPath(team.id, sprint.id)}$`));
    await expect(page.getByText(commentContent)).toBeVisible();
    await expect(page.getByText(sprintName).first()).toBeVisible();

    // After a refresh there is no history inside the app: the back button falls back to the dashboard.
    await page.getByText(Strings.retroBoard.backButton).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(teamName)).toBeVisible();
  });

  test('browser Back and Forward move between the dashboard and the board', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const { teamName, leader, team, sprint, commentContent } = await createTeamWithSprint(request, suffix, 'b');

    await loginAndGoto(page, leader.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await expect(page.getByText(commentContent)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(Strings.sprints.enterRetroButton).first()).toBeVisible();
    await expect(page.getByText(commentContent)).toHaveCount(0);

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`${boardPath(team.id, sprint.id)}$`));
    await expect(page.getByText(commentContent)).toBeVisible();
  });

  test('summary and memory game have their own URLs, survive F5, and "back to board" returns to the board', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const { teamName, leader, team, sprint, commentContent } = await createTeamWithSprint(request, suffix, 'c');
    const board = boardPath(team.id, sprint.id);

    await loginAndGoto(page, leader.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    // Summary (the leader is the team creator, so the button is there).
    await page.getByText(Strings.sprintSummary.openButton).click();
    await expect(page).toHaveURL(new RegExp(`${board}/summary$`));
    await expect(page.getByText(Strings.sprintSummary.pageTitle)).toBeVisible();

    // In-app back (history exists) pops to the board; then forward again and refresh in place.
    await page.getByText(Strings.sprintSummary.backButton).click();
    await expect(page).toHaveURL(new RegExp(`${board}$`));
    await expect(page.getByText(commentContent)).toBeVisible();

    await page.getByText(Strings.memoryBoard.openButton).click();
    await expect(page).toHaveURL(new RegExp(`${board}/memory$`));
    await expect(page.getByText(Strings.memoryBoard.keepCanvasHeader)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${board}/memory$`));
    await expect(page.getByText(Strings.memoryBoard.keepCanvasHeader)).toBeVisible();

    // After the refresh the memory game is the only entry — "back to board" replaces it with the board.
    await page.getByText(Strings.memoryBoard.backButton).click();
    await expect(page).toHaveURL(new RegExp(`${board}$`));
    await expect(page.getByText(commentContent)).toBeVisible();
  });

  test('a shared link opens the sprint directly after login (deep link)', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const { leader, team, sprint, commentContent } = await createTeamWithSprint(request, suffix, 'd');

    // Not logged in: the auth gate shows the login form at the same URL...
    await page.goto(`${boardPath(team.id, sprint.id)}/summary`);
    await expect(page.getByText(commentContent)).toHaveCount(0);

    // ...and once logged in, a load of that same URL lands straight on the summary route.
    await page.evaluate((t) => localStorage.setItem('userToken', t), leader.token);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${boardPath(team.id, sprint.id)}/summary$`));
    await expect(page.getByText(Strings.sprintSummary.pageTitle)).toBeVisible();

    await page.goto(boardPath(team.id, sprint.id));
    await expect(page.getByText(commentContent)).toBeVisible();
  });

  test('a sprint the user cannot see (other team / nonexistent / junk id) shows a not-found screen with a way home', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const mine = await createTeamWithSprint(request, suffix, 'e');
    const other = await createTeamWithSprint(request, suffix, 'f');

    await loginAndGoto(page, mine.leader.token, boardPath(other.team.id, other.sprint.id));
    await expect(page.getByText(Strings.sprintRoute.notFoundTitle)).toBeVisible();
    await expect(page.getByText(other.commentContent)).toHaveCount(0);

    // Right team, wrong sprint id.
    await page.goto(boardPath(mine.team.id, 99999999));
    await expect(page.getByText(Strings.sprintRoute.notFoundTitle)).toBeVisible();

    // Not a number at all.
    await page.goto('/team/abc/sprint/xyz/memory');
    await expect(page.getByText(Strings.sprintRoute.notFoundTitle)).toBeVisible();

    await page.getByText(Strings.sprintRoute.backToDashboardButton).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(mine.teamName)).toBeVisible();
  });

  test('a failed load shows an error with a working retry button', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const { leader, team, sprint, commentContent } = await createTeamWithSprint(request, suffix, 'g');

    await loginAndGoto(page, leader.token);
    // Let the dashboard's own sprint-list request finish first — otherwise it can be the one that
    // hits the "fail once" route below, and the board's request then succeeds.
    await page.getByText(sprint.name).waitFor();
    // Fail only the sprint-route's own sprint-list request, once.
    let failed = false;
    await page.route(`**/teams/${team.id}/sprints`, (route) => {
      if (!failed) {
        failed = true;
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' });
      }
      return route.continue();
    });
    await page.goto(boardPath(team.id, sprint.id));
    await expect(page.getByText(Strings.sprintRoute.loadError)).toBeVisible();

    await page.getByRole('button', { name: Strings.sprintRoute.retryButton }).click();
    await expect(page.getByText(commentContent)).toBeVisible();
  });

  test('renaming a sprint on the board is reflected in the dashboard list after going back', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const { teamName, sprintName, leader } = await createTeamWithSprint(request, suffix, 'h');
    const renamed = `${sprintName} renamed`;

    await loginAndGoto(page, leader.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await page.getByRole('button', { name: Strings.retroBoard.editSprintButton }).click();
    await page.getByPlaceholder(Strings.sprints.sprintNamePlaceholder).fill(renamed);
    await page.getByRole('button', { name: Strings.teamList.saveButton }).click();
    await expect(page.getByText(renamed).first()).toBeVisible();

    await page.getByText(Strings.retroBoard.backButton).click();
    await expect(page.getByText(renamed, { exact: true })).toBeVisible();
    await expect(page.getByText(sprintName, { exact: true })).toHaveCount(0);
  });
});
