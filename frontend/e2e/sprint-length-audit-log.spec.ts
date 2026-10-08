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

const dayIso = (base: Date, offsetDays: number) =>
  new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

test.describe('Sprint length audit log', () => {
  test('admin sees baseline + 2 edits in reverse-chronological order; a plain member sees no history control at all', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Audit Team ${suffix}`;
    const sprintName = `E2E Audit Sprint ${suffix}`;
    const memberUsername = `e2e_pw_audit_member_${suffix}`;
    const adminUsername = `e2e_pw_audit_admin_${suffix}`;
    const editReasonText = `עדכון בעקבות עומס ${suffix}`;

    // --- Setup via direct API calls ---
    // Team creation makes the creator TEAM_LEADER + admin automatically (teams.service.ts::create).
    const admin = await registerAndLogin(request, adminUsername, `${adminUsername}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_audit_approver_${suffix}`);
    const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();

    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    // A plain DEVELOPER, non-admin, non-TEAM_LEADER member — used to confirm the history
    // control is gated on assertCanManageTeamContent (isAdmin || TEAM_LEADER), not just
    // team membership (product-backlog/05-sprint-length-audit-log.md §5.0 decision #2).
    const addMemberRes = await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { username: memberUsername, role: 'DEVELOPER' },
    });
    const membership = await addMemberRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });

    const today = new Date();
    // Baseline (via create): length 14 days.
    const sprintRes = await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: {
        name: sprintName,
        startDate: dayIso(today, 0),
        endDate: dayIso(today, 14),
      },
    });
    const sprint = await sprintRes.json();

    // --- Browser, as admin: edit dates twice in a row (with a reason, then without) ---
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('userToken', token), admin.token);
    await page.reload();

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await expect(page.getByText(sprintName)).toBeVisible();

    // Edit #1: extend end date 14 -> 21 days, with a reason.
    await page.getByRole('button', { name: Strings.retroBoard.editSprintButton }).click();
    await expect(page.getByText(Strings.retroBoard.editSprintHeader)).toBeVisible();

    const endDateInput = page.getByPlaceholder(Strings.sprints.endDateLabel);
    await endDateInput.fill('');
    await endDateInput.fill(dayIso(today, 21));

    const reasonInput = page.getByPlaceholder(Strings.retroBoard.editReasonPlaceholder);
    await reasonInput.fill(editReasonText);

    await page.getByRole('button', { name: Strings.teamList.saveButton }).click();
    await expect(page.getByText(Strings.retroBoard.editSprintHeader)).toHaveCount(0);

    // Edit #2: extend end date 21 -> 28 days, no reason this time. The reason field must
    // reset to blank on every re-open (§5.2), so we deliberately don't touch it here.
    await page.getByRole('button', { name: Strings.retroBoard.editSprintButton }).click();
    await expect(page.getByText(Strings.retroBoard.editSprintHeader)).toBeVisible();
    await expect(page.getByPlaceholder(Strings.retroBoard.editReasonPlaceholder)).toHaveValue('');

    const endDateInput2 = page.getByPlaceholder(Strings.sprints.endDateLabel);
    await endDateInput2.fill('');
    await endDateInput2.fill(dayIso(today, 28));

    await page.getByRole('button', { name: Strings.teamList.saveButton }).click();
    await expect(page.getByText(Strings.retroBoard.editSprintHeader)).toHaveCount(0);

    // --- Open the history panel and verify all 3 records, reverse-chronological ---
    await page.getByRole('button', { name: Strings.retroBoard.lengthHistoryShowButton }).click();
    await expect(page.getByText(Strings.retroBoard.lengthHistoryTitle)).toBeVisible();

    // One entry per record, all attributed to the same admin (changedBy). Scoped to `<p>`
    // elements (how the entry's Typography renders) since the admin's username also appears
    // once more, unrelated, in the sidebar account footer (a non-`<p>` element there).
    await expect(page.locator('p', { hasText: adminUsername })).toHaveCount(3);

    // Unique markers, one per record, used purely to assert DOM (= visual, single-column
    // layout) order — newest first:
    //   - newest (edit #2, no reason): new length is uniquely 28 days (no other record's
    //     previous/new length is 28).
    //   - middle (edit #1, with reason): the only record with a "reason" line at all.
    //   - oldest (baseline): the only record with the "created initially" wording.
    const newestMarker = page.getByText('28 ימים', { exact: true });
    const middleMarker = page.getByText(editReasonText);
    const oldestMarker = page.getByText(Strings.retroBoard.lengthHistoryCreatedInitiallyText);

    await expect(newestMarker).toHaveCount(1);
    await expect(middleMarker).toHaveCount(1);
    await expect(oldestMarker).toHaveCount(1);

    const newestBox = await newestMarker.boundingBox();
    const middleBox = await middleMarker.boundingBox();
    const oldestBox = await oldestMarker.boundingBox();
    expect(newestBox && middleBox && oldestBox).toBeTruthy();
    expect(newestBox!.y).toBeLessThan(middleBox!.y);
    expect(middleBox!.y).toBeLessThan(oldestBox!.y);

    // Sanity on the actual old/new length values shown for the reasoned record (edit #1).
    await expect(page.getByText(/אורך קודם:\s*14 ימים.*אורך חדש:\s*21 ימים/)).toBeVisible();
    // ...and for the reason-less record (edit #2).
    await expect(page.getByText(/אורך קודם:\s*21 ימים.*אורך חדש:\s*28 ימים/)).toBeVisible();

    // --- Browser, as a plain (non-admin, non-TEAM_LEADER) team member: no history control ---
    // The board is a route now (BUG-33): a reload would stay on it, so go back to the dashboard.
    await page.evaluate((token) => localStorage.setItem('userToken', token), member.token);
    await page.goto('/');

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await expect(page.getByText(sprintName)).toBeVisible();

    await expect(page.getByRole('button', { name: Strings.retroBoard.lengthHistoryShowButton })).toHaveCount(0);
    await expect(page.getByRole('button', { name: Strings.retroBoard.lengthHistoryHideButton })).toHaveCount(0);
    await expect(page.getByText(Strings.retroBoard.lengthHistoryTitle)).toHaveCount(0);
  });
});
