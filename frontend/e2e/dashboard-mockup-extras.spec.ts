import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';
import { openAddMemberModal } from './team-members-ui';

const BACKEND_URL = 'http://localhost:5006';
// Hardcoded approver allowlist (backend/src/teams/teams.service.ts) — safe: isolated test DB only.
const APPROVER_EMAIL = 'lironka13@gmail.com';
const DAY = 24 * 60 * 60 * 1000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function register(request: APIRequestContext, username: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, { data: { username, email: `${username}@example.com`, password: 'password123' } });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

async function approverToken(request: APIRequestContext, usernameIfNew: string) {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) return (await registerRes.json()).accessToken as string;
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  return (await loginRes.json()).accessToken as string;
}

async function approvedTeam(request: APIRequestContext, leaderToken: string, name: string, approver: string) {
  const team = await (await request.post(`${BACKEND_URL}/teams`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
    data: { name, approverEmail: APPROVER_EMAIL },
  })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: { Authorization: `Bearer ${approver}` } });
  return team as { id: number };
}

async function addSprint(request: APIRequestContext, token: string, teamId: number, name: string, start: string, end: string) {
  const res = await request.post(`${BACKEND_URL}/teams/${teamId}/sprints`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, startDate: start, endDate: end },
  });
  return (await res.json()) as { id: number };
}

async function loginViaLocalStorage(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.reload();
}

test.describe('Dashboard — mockup extras (header summary, no-active row, summary link, add-member hints, bottom sheet)', () => {
  test('page header, no-active row, summary link on a recently ended sprint', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_extras`;
    const leader = await register(request, `e2e_pw_extras_${suffix}`);
    const approver = await approverToken(request, `e2e_pw_extras_approver_${suffix}`);

    const runningTeam = `E2E Running ${suffix}`;
    const idleTeam = `E2E Idle ${suffix}`;
    const running = await approvedTeam(request, leader.token, runningTeam, approver);
    const idle = await approvedTeam(request, leader.token, idleTeam, approver);
    await addSprint(request, leader.token, running.id, `Live ${suffix}`, day(-2), day(8));
    const ended = await addSprint(request, leader.token, idle.id, `Ended ${suffix}`, day(-12), day(-1));

    await loginViaLocalStorage(page, leader.token);

    // --- Header: "הצוותים שלי", "2 צוותים · ספרינט פעיל אחד", and a "צוות חדש" entry point ---
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    await expect(page.getByText(`${Strings.dashboard.teamsCount(2)} · ${Strings.teamList.summaryActiveSprints(1)}`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: Strings.dashboard.newTeamButton })).toBeVisible();

    // --- A team whose only sprint has ended says so, and the admin can open the create form from it ---
    const noActive = page.getByTestId('no-active-sprint');
    await expect(noActive).toHaveCount(1);
    await expect(noActive).toContainText(Strings.sprints.noActiveSprintText);
    await noActive.getByRole('button', { name: Strings.sprints.createSprintLink }).click();
    await expect(page.getByText(Strings.sprints.createSprintHeader)).toBeVisible();

    // --- The recently ended sprint offers "סיכום" (admin), which opens the summary route ---
    await page.getByRole('button', { name: Strings.sprints.summaryLink }).click();
    await expect(page).toHaveURL(new RegExp(`/team/${idle.id}/sprint/${ended.id}/summary$`));

    // --- "צוות חדש" leads to team creation in settings ---
    await page.goto('/');
    await page.getByRole('button', { name: Strings.dashboard.newTeamButton }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('add-member modal: one hint per tab, invite form open right away, bottom sheet on phones', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_hints`;
    const leader = await register(request, `e2e_pw_hints_${suffix}`);
    const approver = await approverToken(request, `e2e_pw_hints_approver_${suffix}`);
    const teamName = `E2E Hints ${suffix}`;
    await approvedTeam(request, leader.token, teamName, approver);

    await loginViaLocalStorage(page, leader.token);
    await page.getByText(teamName).waitFor();

    await openAddMemberModal(page, 'existing');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(Strings.teamList.addMemberExistingHint)).toBeVisible();

    // Phones: a bottom sheet — full width and flush with the bottom of the screen.
    if (test.info().project.name.includes('Mobile')) {
      const viewport = page.viewportSize()!;
      const paper = (await dialog.boundingBox())!;
      expect(Math.abs(paper.y + paper.height - viewport.height)).toBeLessThan(2);
      expect(paper.width).toBeGreaterThan(viewport.width - 2);
    }

    await dialog.getByText(Strings.teamList.addMemberTabPhantom, { exact: true }).click();
    await expect(dialog.getByText(Strings.teamList.addMemberPhantomHint)).toBeVisible();
    await expect(dialog.getByText(Strings.teamList.addMemberExistingHint)).toHaveCount(0);

    // Link tab: the create form's fields are there without clicking anything first.
    await dialog.getByText(Strings.teamList.addMemberTabLink, { exact: true }).click();
    await expect(dialog.getByText(Strings.teamList.addMemberLinkHint)).toBeVisible();
    await expect(dialog.getByPlaceholder(Strings.invites.namePlaceholder)).toBeVisible();
    await expect(dialog.getByText(Strings.invites.maxUsesLabel)).toBeVisible();
    await expect(dialog.getByText(Strings.teamList.cancelButton, { exact: true })).toHaveCount(0);
  });
});
