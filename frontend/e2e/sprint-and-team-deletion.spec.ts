import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';
import { clickDeleteSprint, expectNoSprintManageActions } from './sprint-actions-ui';
import { openTeamSettings } from './team-members-ui';

// Feature 14 (product-backlog/14-sprint-and-team-deletion.md): soft delete + restore of sprints and
// teams, through the real UI, against the isolated e2e backend (port 5006) — never the real DB.
const BACKEND_URL = 'http://localhost:5006';
const APPROVER_EMAIL = 'naveyadai@gmail.com';

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, { data: { username, email, password: 'password123' } });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number, username };
}
async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const reg = await request.post(`${BACKEND_URL}/auth/register`, { data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' } });
  if (reg.ok()) return { token: (await reg.json()).accessToken as string };
  const login = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  return { token: (await login.json()).accessToken as string };
}
async function loginViaLocalStorage(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.reload();
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function setup(request: APIRequestContext, label: string) {
  const suffix = `${Date.now()}_${label}_${test.info().project.name.replace(/\s+/g, '')}`;
  const leader = await registerAndLogin(request, `e2e_pw_del_leader_${suffix}`, `e2e_pw_del_leader_${suffix}@example.com`);
  const member = await registerAndLogin(request, `e2e_pw_del_member_${suffix}`, `e2e_pw_del_member_${suffix}@example.com`);
  const approver = await ensureApprover(request, `e2e_pw_del_approver_${suffix}`);
  const teamName = `E2E Delete Team ${suffix}`;
  const sprintName = `E2E Delete Sprint ${suffix}`;

  const team = await (await request.post(`${BACKEND_URL}/teams`, { headers: auth(leader.token), data: { name: teamName, approverEmail: APPROVER_EMAIL } })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver.token) });
  const membership = await (await request.post(`${BACKEND_URL}/teams/${team.id}/members`, { headers: auth(leader.token), data: { username: member.username, role: 'DEVELOPER' } })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, { headers: auth(member.token) });

  const today = new Date();
  const sprint = await (await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
    headers: auth(leader.token),
    data: { name: sprintName, startDate: today.toISOString().slice(0, 10), endDate: new Date(today.getTime() + 14 * 864e5).toISOString().slice(0, 10) },
  })).json();
  return { suffix, leader, member, team, teamName, sprint, sprintName };
}

const addComment = (request: APIRequestContext, token: string, sprintId: number, content: string) =>
  request.post(`${BACKEND_URL}/sprints/${sprintId}/comments`, { headers: auth(token), data: { content, type: 'KEEP' } });

test.describe('Sprint and team deletion (product-backlog/14-sprint-and-team-deletion.md)', () => {
  test('an admin deletes a sprint from the board (with a comment-count warning), finds it under "deleted sprints" and restores it with its comments', async ({ page, request }) => {
    test.setTimeout(90_000);
    const { leader, member, team, teamName, sprint, sprintName } = await setup(request, 'sprint');
    const note = `Note that must survive ${sprint.id}`;
    await addComment(request, member.token, sprint.id, note);
    await addComment(request, leader.token, sprint.id, `Second note ${sprint.id}`);

    await loginViaLocalStorage(page, leader.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await expect(page.getByText(note)).toBeVisible();

    // The confirmation says what is about to go with it, and cancelling changes nothing.
    await clickDeleteSprint(page);
    await expect(page.getByText(Strings.sprintDeletion.confirmTitle)).toBeVisible();
    await expect(page.getByText(Strings.sprintDeletion.warning(2))).toBeVisible();
    await page.getByRole('button', { name: Strings.sprintDeletion.cancelButton }).click();
    await expect(page.getByText(Strings.sprintDeletion.confirmTitle)).toHaveCount(0);
    expect((await request.get(`${BACKEND_URL}/teams/${team.id}/sprints`, { headers: auth(leader.token) }).then((r) => r.json())).length).toBe(1);

    await clickDeleteSprint(page);
    await page.getByRole('button', { name: Strings.sprintDeletion.confirmButton }).click();

    // Back on the dashboard: the sprint is gone from the list, and appears under "deleted sprints".
    await page.getByText(teamName).waitFor();
    await expect(page.getByText(sprintName)).toHaveCount(0);
    await page.getByRole('button', { name: Strings.sprintDeletion.deletedSectionTitle }).click();
    const row = page.locator('[data-testid="deleted-sprint-row"]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(sprintName);
    await expect(row).toContainText(Strings.sprintDeletion.commentCount(2));
    await expect(row).toContainText(Strings.sprintDeletion.daysLeft(30));

    // The board URL of a deleted sprint is a "not found", for everyone.
    expect((await request.get(`${BACKEND_URL}/sprints/${sprint.id}/comments`, { headers: auth(member.token) })).status()).toBe(404);

    await page.getByRole('button', { name: Strings.sprintDeletion.restoreButton }).click();
    await expect(page.locator('[data-testid="deleted-sprint-row"]')).toHaveCount(0);
    await expect(page.getByText(sprintName)).toBeVisible();

    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await expect(page.getByText(note)).toBeVisible(); // the comments came back with it
  });

  test('a regular member sees neither "delete sprint" nor the deleted-sprints list, and the API refuses them', async ({ page, request }) => {
    const { member, team, teamName, sprint, sprintName } = await setup(request, 'sprintmember');

    await loginViaLocalStorage(page, member.token);
    await page.getByText(teamName).waitFor();
    await expect(page.getByText(sprintName)).toBeVisible();
    await expect(page.getByRole('button', { name: Strings.sprintDeletion.deletedSectionTitle })).toHaveCount(0);

    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await page.getByText(Strings.retroBoard.writeNoteHeader).waitFor();
    await expectNoSprintManageActions(page);

    expect((await request.delete(`${BACKEND_URL}/teams/${team.id}/sprints/${sprint.id}`, { headers: auth(member.token) })).status()).toBe(403);
    expect((await request.get(`${BACKEND_URL}/teams/${team.id}/sprints/deleted`, { headers: auth(member.token) })).status()).toBe(403);
  });

  test('an admin deletes a team only after typing its exact name; members lose it; it can be restored from the settings', async ({ page, request, browser }) => {
    test.setTimeout(120_000);
    const { leader, member, team, teamName, sprintName } = await setup(request, 'team');

    await loginViaLocalStorage(page, leader.token);
    await page.getByText(teamName).waitFor();
    await openTeamSettings(page);

    await page.getByRole('button', { name: Strings.teamDeletion.deleteTeamButton }).click();
    await expect(page.getByText(Strings.teamDeletion.confirmPrompt(teamName))).toBeVisible();
    const confirm = page.getByRole('button', { name: Strings.teamDeletion.confirmButton });
    await expect(confirm).toBeDisabled();

    const input = page.getByPlaceholder(Strings.teamDeletion.confirmPlaceholder);
    await input.fill(`${teamName} x`);
    await expect(confirm).toBeDisabled();
    await input.fill(teamName);
    await expect(confirm).toBeEnabled();

    // Cancelling keeps the team.
    await page.getByRole('button', { name: Strings.teamDeletion.cancelButton }).click();
    expect((await request.get(`${BACKEND_URL}/teams/user/me`, { headers: auth(leader.token) }).then((r) => r.json())).some((t: any) => t.id === team.id)).toBe(true);

    await page.getByRole('button', { name: Strings.teamDeletion.deleteTeamButton }).click();
    await page.getByPlaceholder(Strings.teamDeletion.confirmPlaceholder).fill(teamName);
    await page.getByRole('button', { name: Strings.teamDeletion.confirmButton }).click();

    // The team disappears from the dashboard…
    await expect(page.getByText(teamName)).toHaveCount(0);
    // …and from the other member's.
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await memberPage.goto('/');
    await memberPage.evaluate((t) => localStorage.setItem('userToken', t), member.token);
    await memberPage.reload();
    await expect(memberPage.getByText(teamName)).toHaveCount(0);
    await memberContext.close();
    expect((await request.get(`${BACKEND_URL}/teams/${team.id}/sprints`, { headers: auth(member.token) })).status()).toBe(404);

    // The admin finds it in the settings, with its sprint count and days left, and restores it.
    await page.goto('/settings');
    await page.getByText(Strings.deletedTeams.cardTitle).waitFor();
    const row = page.locator('[data-testid="deleted-team-row"]', { hasText: teamName });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(Strings.deletedTeams.sprintCount(1));
    await expect(row).toContainText(Strings.deletedTeams.daysLeft(30));
    await row.getByRole('button', { name: Strings.deletedTeams.restoreButton }).click();
    await expect(page.locator('[data-testid="deleted-team-row"]', { hasText: teamName })).toHaveCount(0);

    // Back on the dashboard with everything as it was.
    await page.goto('/');
    await page.getByText(teamName).waitFor();
    await expect(page.getByText(sprintName)).toBeVisible();
    expect((await request.get(`${BACKEND_URL}/teams/user/me`, { headers: auth(member.token) }).then((r) => r.json())).some((t: any) => t.id === team.id)).toBe(true);
  });

  test('a regular member gets no danger zone and no deleted-teams entry for a team they cannot restore', async ({ page, request }) => {
    const { member, team, teamName } = await setup(request, 'teammember');

    await loginViaLocalStorage(page, member.token);
    await page.getByText(teamName).waitFor();
    // Members have no gear (settings are for admins / team leaders) — and so no danger zone.
    await expect(page.getByRole('button', { name: Strings.teamSettingsPanel.title })).toHaveCount(0);
    expect((await request.delete(`${BACKEND_URL}/teams/${team.id}`, { headers: auth(member.token), data: { confirmName: teamName } })).status()).toBe(403);
  });
});
