import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';
import { openMembers } from './team-members-ui';

// Feature 11 (product-backlog/11-team-leave-and-removal.md §11.3) — leaving a team and the
// team-leader removal permission, end to end against the isolated e2e backend (5006).
const BACKEND_URL = 'http://localhost:5006';
// Hardcoded approver allowlist (backend/src/teams/teams.service.ts) — safe: isolated test DB only.
const APPROVER_EMAIL = 'lironka13@gmail.com';
const DAY = 24 * 60 * 60 * 1000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function registerAndLogin(request: APIRequestContext, username: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, { data: { username, email: `${username}@example.com`, password: 'password123' } });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number, username };
}

async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) return (await registerRes.json()).accessToken as string;
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  return (await loginRes.json()).accessToken as string;
}

async function joinTeam(request: APIRequestContext, teamId: number, adminToken: string, user: { token: string; username: string }, role: string) {
  const inviteRes = await request.post(`${BACKEND_URL}/teams/${teamId}/members`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { username: user.username, role },
  });
  const invite = await inviteRes.json();
  await request.post(`${BACKEND_URL}/teams/${teamId}/members/${invite.id}/accept`, { headers: { Authorization: `Bearer ${user.token}` } });
}

async function loginAs(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.reload();
}

test.describe('Leaving a team (feature 11)', () => {
  // Four users switch in and out of one browser — well past the 30s default.
  test.setTimeout(120_000);

  test('team leader removes a regular member, a member leaves, the last admin hands over before leaving', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Leave Team ${suffix}`;
    const admin = await registerAndLogin(request, `e2e_pw_leave_admin_${suffix}`);
    const leaver = await registerAndLogin(request, `e2e_pw_leave_dev_${suffix}`);
    const leader = await registerAndLogin(request, `e2e_pw_leave_lead_${suffix}`);
    const removed = await registerAndLogin(request, `e2e_pw_leave_removed_${suffix}`);
    const approverToken = await ensureApprover(request, `e2e_pw_leave_approver_${suffix}`);

    const team = await (await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    })).json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: { Authorization: `Bearer ${approverToken}` } });
    await joinTeam(request, team.id, admin.token, leaver, 'DEVELOPER');
    await joinTeam(request, team.id, admin.token, leader, 'TEAM_LEADER');
    await joinTeam(request, team.id, admin.token, removed, 'DEVELOPER');

    // The leaver writes a retro comment first — it must stay, labelled "לא בצוות", after they leave.
    const sprint = await (await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: `Sprint ${suffix}`, startDate: day(-3), endDate: day(7) },
    })).json();
    const commentText = `Leaving soon ${suffix}`;
    await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leaver.token}` },
      data: { content: commentText, type: 'KEEP' },
    });

    // --- 1. A team leader (not an admin) removes a regular member, but can't touch the admin ---
    await loginAs(page, leader.token);
    await page.getByText(teamName).waitFor();
    await openMembers(page);
    await expect(page.getByRole('button', { name: Strings.teamList.manageMemberLabel(`@${admin.username}`) })).toHaveCount(0);
    await page.getByRole('button', { name: Strings.teamList.manageMemberLabel(`@${removed.username}`) }).click();
    await page.getByText(Strings.teamList.removeMemberButton, { exact: true }).click();
    await page.getByText(Strings.teamList.removeMemberConfirmButton, { exact: true }).click();
    await expect(page.getByText(`@${removed.username}`)).toHaveCount(0);

    // --- 2. A regular member leaves; the team disappears from their dashboard ---
    await loginAs(page, leaver.token);
    await page.getByText(teamName).waitFor();
    await openMembers(page);
    await page.getByText(Strings.teamList.leaveTeamButton, { exact: true }).click();
    await expect(page.getByText(Strings.teamList.leaveConsequences)).toBeVisible();
    await page.getByText(Strings.teamList.leaveConfirmButton, { exact: true }).click();
    await expect(page.getByText(teamName)).toHaveCount(0);

    // --- 3. Their comment is still on the board, labelled "לא בצוות" ---
    await loginAs(page, leader.token);
    await page.goto(`/team/${team.id}/sprint/${sprint.id}`);
    const comment = page.getByText(commentText);
    await expect(comment).toBeVisible();
    await expect(page.getByText(Strings.retroBoard.formerMemberBadge, { exact: true })).toBeVisible();

    // --- 4. The last admin can't leave without naming a successor ---
    await loginAs(page, admin.token);
    await page.getByText(teamName).waitFor();
    await openMembers(page);
    await page.getByText(Strings.teamList.leaveTeamButton, { exact: true }).click();
    const confirm = page.getByRole('button', { name: Strings.teamList.leaveConfirmButton });
    await expect(confirm).toBeDisabled();
    await page.getByRole('radio', { name: `@${leader.username}` }).click();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText(teamName)).toHaveCount(0);

    // The successor is now the team's admin.
    const members = await (await request.get(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    })).json();
    expect(members.find((m: any) => m.userId === leader.id)).toMatchObject({ isAdmin: true });
    expect(members.find((m: any) => m.userId === admin.id)).toBeUndefined();
  });

  test('the last real member is told they cannot leave', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_solo`;
    const teamName = `E2E Solo Team ${suffix}`;
    const solo = await registerAndLogin(request, `e2e_pw_leave_solo_${suffix}`);
    const approverToken = await ensureApprover(request, `e2e_pw_leave_solo_approver_${suffix}`);
    const team = await (await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${solo.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    })).json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: { Authorization: `Bearer ${approverToken}` } });

    await loginAs(page, solo.token);
    await page.getByText(teamName).waitFor();
    await openMembers(page);
    await page.getByText(Strings.teamList.leaveTeamButton, { exact: true }).click();

    await expect(page.getByText(Strings.teamList.leaveLastMemberText)).toBeVisible();
    await expect(page.getByText(Strings.teamList.leaveConfirmButton, { exact: true })).toHaveCount(0);
  });
});
