import { test, expect, type APIRequestContext } from '@playwright/test';
import { Strings } from '../src/constants/strings';
import { openTeamSettings } from './team-members-ui';

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

test.describe('Team comment categories (product-backlog/03-team-comment-categories.md)', () => {
  test('team leader manages categories (disable a default, add a custom one); a plain member never sees the panel; a disabled-but-used category stays filterable', async ({ page, request }) => {
    test.setTimeout(60_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Categories Team ${suffix}`;
    const sprintName = `E2E Categories Sprint ${suffix}`;
    const memberUsername = `e2e_pw_cat_member_${suffix}`;
    const customCategoryLabel = `תיאום בין צוותים ${suffix}`;

    // --- Setup via direct API calls ---
    // Team creation makes the creator TEAM_LEADER + admin automatically (teams.service.ts::create),
    // which also auto-seeds the 13 default categories (teams.service.ts::create, §3.1).
    const leader = await registerAndLogin(request, `e2e_pw_cat_leader_${suffix}`, `e2e_pw_cat_leader_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_cat_approver_${suffix}`);
    const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    // A plain DEVELOPER, non-admin, non-TEAM_LEADER member — confirms the management panel is
    // gated on isAdmin/TEAM_LEADER (§3.0 decision #2), same as invites/highlighting.
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

    // A comment tagged with the "בדיקות" (TESTING) default category, posted while it's still
    // enabled — this is the pre-existing data the "disabled-but-used" edge case below depends on.
    const categoriesRes = await request.get(`${BACKEND_URL}/teams/${team.id}/categories`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    });
    const teamCategories = await categoriesRes.json();
    const testingCategoryId = teamCategories.find((c: any) => c.label === Strings.retroBoard.categories.TESTING)?.id;
    expect(testingCategoryId).toBeTruthy();
    const testingComment = `Comment tagged with a soon-to-be-disabled category, ${suffix}.`;
    await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { content: testingComment, type: 'KEEP', categoryId: testingCategoryId, isAnonymous: false },
    });

    // --- Browser, as the team leader: open the management panel, disable "בדיקות", add a custom category ---
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('userToken', token), leader.token);
    await page.reload();

    await page.getByText(teamName).waitFor();
    await openTeamSettings(page);
    await page.getByText(Strings.categoryManagement.loadingText).waitFor({ state: 'hidden' }).catch(() => {});

    // §3.1: every default category label from the seed list is present, badged as "דיפולטית".
    const testingRow = page.getByText(Strings.retroBoard.categories.TESTING, { exact: true })
      .locator('xpath=ancestor::div[.//button[@role="switch"]][1]');
    await expect(testingRow.getByText(Strings.categoryManagement.defaultBadge)).toBeVisible();
    const testingSwitch = testingRow.getByRole('switch');
    await expect(testingSwitch).toHaveAttribute('aria-checked', 'true');

    await testingSwitch.click();
    await expect(testingSwitch).toHaveAttribute('aria-checked', 'false');

    // Add a custom category.
    await page.getByText(Strings.categoryManagement.createButton).click();
    await page.getByPlaceholder(Strings.categoryManagement.newCategoryPlaceholder).fill(customCategoryLabel);
    await page.getByText(Strings.categoryManagement.createButton).click();

    const customRow = page.getByText(customCategoryLabel, { exact: true })
      .locator('xpath=ancestor::div[.//button[@role="switch"]][1]');
    await expect(customRow.getByText(Strings.categoryManagement.customBadge)).toBeVisible();
    await expect(customRow.getByRole('switch')).toHaveAttribute('aria-checked', 'true');

    // --- Enter the retro board: the compose form only offers enabled categories ---
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await page.getByText(Strings.retroBoard.writeNoteHeader).waitFor();

    // The already-loaded comment still shows its (now-disabled) category label on its own card.
    await expect(page.getByText(testingComment)).toBeVisible();

    await page.getByText(Strings.retroBoard.categoryNone).click();
    await expect(page.getByRole('option', { name: Strings.retroBoard.categories.PLANNING, exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: customCategoryLabel })).toBeVisible();
    // Disabled — must not be offered when composing a NEW comment, even though it's still in use.
    await expect(page.getByRole('option', { name: Strings.retroBoard.categories.TESTING })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // --- The filter bar, however, still offers the disabled category — it's still in use ---
    await page.getByText(Strings.retroBoard.filterAllCategoriesLabel).click();
    await expect(page.getByRole('option', { name: Strings.retroBoard.categories.TESTING })).toBeVisible();
    await page.getByRole('option', { name: Strings.retroBoard.categories.TESTING }).click();
    await page.keyboard.press('Escape');

    await expect(page.getByText(testingComment)).toBeVisible();

    // --- Browser, as a plain (non-admin, non-leader) team member ---
    // The board is a route now (BUG-33): a reload would stay on it, so go back to the dashboard.
    await page.evaluate((token) => localStorage.setItem('userToken', token), member.token);
    await page.goto('/');
    await page.getByText(teamName).waitFor();

    // The management panel's entry point is entirely absent from the DOM, not just hidden.
    await expect(page.getByRole('button', { name: Strings.teamSettingsPanel.title })).toHaveCount(0);

    // The plain member's own compose form also only offers enabled categories (same guard client-side).
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await page.getByText(Strings.retroBoard.writeNoteHeader).waitFor();
    await page.getByText(Strings.retroBoard.categoryNone).click();
    await expect(page.getByRole('option', { name: Strings.retroBoard.categories.TESTING })).toHaveCount(0);
    await expect(page.getByRole('option', { name: customCategoryLabel })).toBeVisible();
  });
});
