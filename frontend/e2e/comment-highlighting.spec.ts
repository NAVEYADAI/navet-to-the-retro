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

test.describe('Comment highlighting', () => {
  test('team leader can highlight/unhighlight and filter; a plain member cannot', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Highlight Team ${suffix}`;
    const sprintName = `E2E Highlight Sprint ${suffix}`;
    const memberUsername = `e2e_pw_hl_member_${suffix}`;

    // --- Setup via direct API calls ---
    // Team creation makes the creator TEAM_LEADER + admin automatically (teams.service.ts::create).
    const leader = await registerAndLogin(request, `e2e_pw_hl_leader_${suffix}`, `e2e_pw_hl_leader_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_hl_approver_${suffix}`);
    const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();

    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    // A plain DEVELOPER, non-admin member — used to confirm the highlight control is gated
    // on isAdmin/TEAM_LEADER, not just team membership (see product-backlog/02-comment-highlighting.md §2.0).
    const addMemberRes = await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { username: memberUsername, role: 'DEVELOPER' },
    });
    const membership = await addMemberRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });

    const today = new Date();
    const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const sprintRes = await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: {
        name: sprintName,
        startDate: today.toISOString().slice(0, 10),
        endDate: twoWeeksOut.toISOString().slice(0, 10),
      },
    });
    const sprint = await sprintRes.json();

    // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.1):
    // comments are categorized by categoryId (FK into the team's own TeamCommentCategory rows),
    // not a raw enum string anymore — look up the seeded default category's id by its label.
    const categoriesRes = await request.get(`${BACKEND_URL}/teams/${team.id}/categories`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    });
    const teamCategories = await categoriesRes.json();
    const testingCategoryId = teamCategories.find((c: any) => c.label === Strings.retroBoard.categories.TESTING)?.id;
    expect(testingCategoryId).toBeTruthy();

    // Categorized on purpose: the comment card renders the category badge and the highlight
    // toggle in the same row, so this also exercises that the two coexist without collision.
    await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { content: 'Comment to highlight.', type: 'KEEP', categoryId: testingCategoryId, isAnonymous: false },
    });
    await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { content: 'A plain, unhighlighted comment.', type: 'KEEP', isAnonymous: false },
    });

    // --- Browser, as team leader: highlight the first comment, then filter by it ---
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('userToken', token), leader.token);
    await page.reload();

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page.getByText('Comment to highlight.')).toBeVisible();
    await expect(page.getByText('A plain, unhighlighted comment.')).toBeVisible();

    await expect(page.getByText(Strings.retroBoard.categories.TESTING)).toBeVisible();

    const highlightButton = page.getByRole('button', { name: Strings.retroBoard.highlightButton }).first();
    await highlightButton.click();
    const unhighlightButton = page.getByRole('button', { name: Strings.retroBoard.unhighlightButton });
    await expect(unhighlightButton).toBeVisible();

    // RTL sanity check: the category badge and the highlight toggle share one row at the top
    // of the card. In a right-to-left layout the badge (first in source order) must render to
    // the right of the toggle (second) — i.e. a larger x — not just "somewhere on the card."
    const categoryBox = await page.getByText(Strings.retroBoard.categories.TESTING).boundingBox();
    const toggleBox = await unhighlightButton.boundingBox();
    expect(categoryBox && toggleBox).toBeTruthy();
    expect(categoryBox!.x).toBeGreaterThan(toggleBox!.x);

    await page.getByText(Strings.retroBoard.highlightedOnlyFilterLabel).click();
    await expect(page.getByText('Comment to highlight.')).toBeVisible();
    await expect(page.getByText('A plain, unhighlighted comment.')).toHaveCount(0);

    // --- Browser, as a plain (non-admin, non-leader) team member: no highlight control at all ---
    // The board is a route now (BUG-33): a reload would stay on it, so go back to the dashboard.
    await page.evaluate((token) => localStorage.setItem('userToken', token), member.token);
    await page.goto('/');

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page.getByText('Comment to highlight.')).toBeVisible();
    await expect(page.getByRole('button', { name: Strings.retroBoard.highlightButton })).toHaveCount(0);
    await expect(page.getByRole('button', { name: Strings.retroBoard.unhighlightButton })).toHaveCount(0);
  });
});
