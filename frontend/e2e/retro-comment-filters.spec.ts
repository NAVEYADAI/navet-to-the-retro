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

test.describe('Sprint retro board — comment filters', () => {
  test('filters comments by category and by free text', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Filter Team ${suffix}`;
    const sprintName = `E2E Filter Sprint ${suffix}`;

    // --- Setup via direct API calls (fast, deterministic) — the browser is only used for
    // the actual feature under test below. ---
    const creator = await registerAndLogin(request, `e2e_pw_creator_${suffix}`, `e2e_pw_creator_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_approver_${suffix}`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();

    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    // Must not be expired (see getSprintStatus in sprint-list-web/native.tsx) or the sprint
    // renders collapsed under "ספרינטים שהסתיימו" instead of directly enterable.
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

    const commentDefs = [
      { content: 'Great velocity this sprint!', type: 'KEEP', categoryId: categoryIdFor('PLANNING') },
      { content: 'Testing took too long.', type: 'IMPROVE', categoryId: categoryIdFor('TESTING') },
      { content: 'Good team communication.', type: 'KEEP', categoryId: categoryIdFor('GENERAL') },
    ];
    for (const c of commentDefs) {
      await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
        headers: { Authorization: `Bearer ${creator.token}` },
        data: { ...c, isAnonymous: false },
      });
    }

    // --- Browser: log in by seeding the same localStorage key AuthContext reads on boot,
    // then drive the actual UI. ---
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('userToken', token), creator.token);
    await page.reload();

    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    await expect(page.getByText('Great velocity this sprint!')).toBeVisible();
    await expect(page.getByText('Testing took too long.')).toBeVisible();
    await expect(page.getByText('Good team communication.')).toBeVisible();

    // Category filter (Desktop: MUI Select; Mobile: same component, touch-driven).
    await page.getByText(Strings.retroBoard.filterAllCategoriesLabel).click();
    await page.getByRole('option', { name: Strings.retroBoard.categories.TESTING }).click();
    await page.keyboard.press('Escape');

    await expect(page.getByText('Testing took too long.')).toBeVisible();
    await expect(page.getByText('Great velocity this sprint!')).toHaveCount(0);
    await expect(page.getByText('Good team communication.')).toHaveCount(0);

    // Clear, then use the free-text filter instead.
    await page.getByText(Strings.retroBoard.clearFiltersLabel).click();
    await page.getByPlaceholder(Strings.retroBoard.searchPlaceholder).fill('communication');

    await expect(page.getByText('Good team communication.')).toBeVisible();
    await expect(page.getByText('Great velocity this sprint!')).toHaveCount(0);
    await expect(page.getByText('Testing took too long.')).toHaveCount(0);
  });
});
