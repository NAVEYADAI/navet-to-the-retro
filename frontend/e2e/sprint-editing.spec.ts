import { test, expect, type APIRequestContext } from '@playwright/test';
import { Strings } from '../src/constants/strings';

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

// The approver allowlist is a fixed pair of real email addresses (see APPROVER_EMAIL below),
// so every project/test in a single suite run shares the same approver account — the first
// one registers it, the rest just log in (backend accepts an email in the username field).
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

test.describe('Sprint editing', () => {
  test('team admin can edit a sprint\'s details; a plain member cannot see the edit control', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Edit Team ${suffix}`;
    const sprintName = `E2E Edit Sprint ${suffix}`;
    const updatedSprintName = `E2E Edit Sprint ${suffix} — Updated`;
    const memberUsername = `e2e_pw_edit_member_${suffix}`;

    // --- Setup via direct API calls ---
    // Team creation makes the creator TEAM_LEADER + admin automatically (teams.service.ts::create).
    const admin = await registerAndLogin(request, `e2e_pw_edit_admin_${suffix}`, `e2e_pw_edit_admin_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_edit_approver_${suffix}`);
    const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();

    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    // A plain DEVELOPER, non-admin member — used to confirm the edit control is gated on
    // isAdmin, the same guard as sprint creation (see product-backlog/04-sprint-editing.md's sprint-editing entry).
    const addMemberRes = await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { username: memberUsername, role: 'DEVELOPER' },
    });
    const membership = await addMemberRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });

    const today = new Date();
    const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const threeWeeksOut = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000);
    const sprintRes = await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: {
        name: sprintName,
        startDate: today.toISOString().slice(0, 10),
        endDate: twoWeeksOut.toISOString().slice(0, 10),
      },
    });
    const sprint = await sprintRes.json();

    // --- Browser, as team admin: edit the sprint's name and end date ---
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('userToken', token), admin.token);
    await page.reload();

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page.getByText(sprintName)).toBeVisible();

    await page.getByRole('button', { name: Strings.retroBoard.editSprintButton }).click();
    await expect(page.getByText(Strings.retroBoard.editSprintHeader)).toBeVisible();

    const nameInput = page.getByPlaceholder(Strings.sprints.sprintNamePlaceholder);
    await nameInput.fill('');
    await nameInput.fill(updatedSprintName);

    const endDateInput = page.getByPlaceholder(Strings.sprints.endDateLabel);
    await endDateInput.fill('');
    await endDateInput.fill(threeWeeksOut.toISOString().slice(0, 10));

    await page.getByRole('button', { name: Strings.teamList.saveButton }).click();

    // Reflected immediately, without leaving the board or re-selecting the sprint.
    await expect(page.getByText(updatedSprintName)).toBeVisible();
    await expect(page.getByText(sprintName, { exact: true })).toHaveCount(0);

    // --- Browser, as a plain (non-admin) team member: no edit control at all ---
    await page.evaluate((token) => localStorage.setItem('userToken', token), member.token);
    await page.reload();

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page.getByText(updatedSprintName)).toBeVisible();
    await expect(page.getByRole('button', { name: Strings.retroBoard.editSprintButton })).toHaveCount(0);
  });
});
