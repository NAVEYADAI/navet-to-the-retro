import { test, expect, type APIRequestContext } from '@playwright/test';
import { Strings } from '../src/constants/strings';

const BACKEND_URL = 'http://localhost:5006';
// Team creation only accepts a hardcoded approver allowlist (backend/src/teams/teams.service.ts)
// — safe to use here since this suite only ever runs against the isolated test database.
const APPROVER_EMAIL = 'naveyadai@gmail.com';

// Matches buildExportFileName() in backend/src/sprints/sprint-summary.builder.ts — the file
// name is the sprint's own name plus the date it was generated (today), not its id.
function expectedExportFileName(sprintName: string): string {
  return `${sprintName} - ${new Date().toLocaleDateString('he-IL')}.pptx`;
}

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

test.describe('Sprint summary export', () => {
  test('the creator and any team admin see the export button; a plain member does not', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Summary Team ${suffix}`;
    const sprintName = `E2E Summary Sprint ${suffix}`;
    const memberUsername = `e2e_pw_member_${suffix}`;
    const adminUsername = `e2e_pw_admin_${suffix}`;

    // --- Setup via direct API calls ---
    const creator = await registerAndLogin(request, `e2e_pw_creator_${suffix}`, `e2e_pw_creator_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_approver_${suffix}`);
    const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);
    const admin = await registerAndLogin(request, adminUsername, `${adminUsername}@example.com`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();

    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    // A plain, non-admin, non-creator member — confirms the export button is still gated
    // (not visible to just anyone on the team), per product-backlog/01-sprint-summary-export.md §1.0.
    const addMemberRes = await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { username: memberUsername, role: 'DEVELOPER' },
    });
    const membership = await addMemberRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });

    // A non-creator team ADMIN — confirms admins can export too (updated 2026-09-01 per Nave:
    // creator-or-admin, not creator-only).
    const addAdminRes = await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { username: adminUsername, role: 'DEVELOPER' },
    });
    const adminMembership = await addAdminRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${adminMembership.id}/accept`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    await request.patch(`${BACKEND_URL}/teams/${team.id}/members/${adminMembership.id}`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { isAdmin: true },
    });

    const today = new Date();
    const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const sprintRes = await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: {
        name: sprintName,
        startDate: today.toISOString().slice(0, 10),
        endDate: twoWeeksOut.toISOString().slice(0, 10),
      },
    });
    const sprint = await sprintRes.json();

    // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.1):
    // comments are categorized by categoryId (FK into the team's own TeamCommentCategory rows),
    // not a raw enum string anymore — look up each seeded default category's id by its label.
    const categoriesRes = await request.get(`${BACKEND_URL}/teams/${team.id}/categories`, {
      headers: { Authorization: `Bearer ${creator.token}` },
    });
    const teamCategories = await categoriesRes.json();
    const categoryIdFor = (key: string) => {
      const id = teamCategories.find((c: any) => c.label === Strings.retroBoard.categories[key])?.id;
      expect(id).toBeTruthy();
      return id;
    };

    // Three comments across two categories + one uncategorized — exercises the "לפי קטגוריה"
    // breakdown on the summary screen, not just the KEEP/IMPROVE totals.
    await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { content: 'Great sprint overall.', type: 'KEEP', isAnonymous: false },
    });
    await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { content: 'Planning ran smoothly.', type: 'KEEP', categoryId: categoryIdFor('PLANNING'), isAnonymous: false },
    });
    await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { content: 'Testing took too long.', type: 'IMPROVE', categoryId: categoryIdFor('TESTING'), isAnonymous: false },
    });

    // --- Browser, as the team creator: the export button is visible and downloads a file ---
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('userToken', token), creator.token);
    await page.reload();

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page.getByText(Strings.sprintSummary.openButton)).toBeVisible();
    await page.getByText(Strings.sprintSummary.openButton).click();

    await expect(page.getByText(Strings.sprintSummary.pageTitle)).toBeVisible();
    await expect(page.getByText(sprintName)).toBeVisible();

    // Category breakdown: each category from the comments above shows up with the right count.
    const categoryRows: Array<[string, number]> = [
      [Strings.retroBoard.categories.PLANNING, 1],
      [Strings.retroBoard.categories.TESTING, 1],
      [Strings.retroBoard.categoryNone, 1],
    ];
    for (const [label, count] of categoryRows) {
      const row = page.getByText(label, { exact: true }).locator('xpath=..');
      await expect(row).toContainText(String(count));
    }

    // RTL sanity check #1: the "by category" rows (label + count) never wrap onto separate
    // lines regardless of viewport, so their x-order is a reliable cross-viewport check — in a
    // right-to-left layout the label (first in source order) must render to the right of the
    // count (second), i.e. a larger x.
    const planningRow = page.getByText(Strings.retroBoard.categories.PLANNING, { exact: true }).locator('xpath=..');
    const labelBox = await page.getByText(Strings.retroBoard.categories.PLANNING, { exact: true }).boundingBox();
    const countBox = await planningRow.getByText('1', { exact: true }).boundingBox();
    expect(labelBox && countBox).toBeTruthy();
    expect(labelBox!.x).toBeGreaterThan(countBox!.x);

    // RTL sanity check #2: the total/keep/improve stats row reads, right to left, "total →
    // keep → improve" on wide viewports — but it's a `flexWrap` row that legitimately stacks
    // on narrow ones (Mobile Chrome), so only assert x-order when all three still share a line.
    const totalBox = await page.getByText(Strings.sprintSummary.totalCommentsLabel, { exact: true }).boundingBox();
    const keepBox = await page.getByText(Strings.sprintSummary.keepCountLabel, { exact: true }).boundingBox();
    const improveBox = await page.getByText(Strings.sprintSummary.improveCountLabel, { exact: true }).boundingBox();
    expect(totalBox && keepBox && improveBox).toBeTruthy();
    const sameRow = Math.abs(totalBox!.y - improveBox!.y) < 5;
    if (sameRow) {
      expect(totalBox!.x).toBeGreaterThan(keepBox!.x);
      expect(keepBox!.x).toBeGreaterThan(improveBox!.x);
    }

    const downloadPromise = page.waitForEvent('download');
    await page.getByText(Strings.sprintSummary.downloadButton, { exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(expectedExportFileName(sprintName));

    // --- Browser, as a plain non-creator, non-admin team member: no export button at all ---
    // The summary is a route now (BUG-33): a reload would stay on it, so go back to the dashboard.
    await page.evaluate((token) => localStorage.setItem('userToken', token), member.token);
    await page.goto('/');

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page.getByText('Great sprint overall.')).toBeVisible();
    await expect(page.getByText(Strings.sprintSummary.openButton)).toHaveCount(0);

    // --- Browser, as a non-creator team ADMIN: sees the button and can download too ---
    await page.evaluate((token) => localStorage.setItem('userToken', token), admin.token);
    await page.goto('/');

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page.getByText(Strings.sprintSummary.openButton)).toBeVisible();
    await page.getByText(Strings.sprintSummary.openButton).click();

    // Template picker: switching off the default template must not break the download or
    // change the file name (the template only affects the pptx's own styling).
    await page.getByText('כהה', { exact: true }).click();

    const adminDownloadPromise = page.waitForEvent('download');
    await page.getByText(Strings.sprintSummary.downloadButton, { exact: true }).click();
    const adminDownload = await adminDownloadPromise;
    expect(adminDownload.suggestedFilename()).toBe(expectedExportFileName(sprintName));
  });
});
