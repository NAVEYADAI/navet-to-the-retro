import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
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

async function loginAs(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.reload();
}

/** Common setup shared by every test below: a team (leader + one plain, non-admin member), an
 * open (non-expired) sprint, one KEEP comment (non-anonymous) and one IMPROVE comment
 * (anonymous) — enough to exercise both canvases and both author-name code paths. */
async function setupTeamSprintAndComments(request: APIRequestContext, suffix: string) {
  const teamName = `E2E Memory Team ${suffix}`;
  const sprintName = `E2E Memory Sprint ${suffix}`;
  const memberUsername = `e2e_pw_mem_member_${suffix}`;

  // Team creation makes the creator TEAM_LEADER + admin automatically (teams.service.ts::create).
  const leader = await registerAndLogin(request, `e2e_pw_mem_leader_${suffix}`, `e2e_pw_mem_leader_${suffix}@example.com`);
  const approver = await ensureApprover(request, `e2e_pw_mem_approver_${suffix}`);
  const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);

  const teamRes = await request.post(`${BACKEND_URL}/teams`, {
    headers: { Authorization: `Bearer ${leader.token}` },
    data: { name: teamName, approverEmail: APPROVER_EMAIL },
  });
  const team = await teamRes.json();

  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
    headers: { Authorization: `Bearer ${approver.token}` },
  });

  // A plain DEVELOPER, non-admin, non-TEAM_LEADER member — used to confirm the memory-board
  // entry point has NO isAdmin/role gate (product-backlog/08-memory-board.md §8.0 decision #7), unlike
  // canHighlight/canExportSummary/canEditSprint elsewhere on the same screen.
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

  const keepContent = `Keep comment content ${suffix}`;
  const improveContent = `Improve comment content ${suffix}`;
  const leaderUsername = `e2e_pw_mem_leader_${suffix}`;
  await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
    headers: { Authorization: `Bearer ${leader.token}` },
    data: { content: keepContent, type: 'KEEP', categoryId: testingCategoryId, isAnonymous: false },
  });
  await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
    headers: { Authorization: `Bearer ${member.token}` },
    data: { content: improveContent, type: 'IMPROVE', isAnonymous: true },
  });

  return { teamName, sprintName, leader, member, keepContent, improveContent, leaderUsername };
}

test.describe('Memory board (memory-game retro view)', () => {
  test('any team member (including a plain, non-admin member) can open it, sees two face-down canvases, flips reveal content, double-click enlarges in place, and can return to the normal board', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const { teamName, member, keepContent, improveContent, leaderUsername } = await setupTeamSprintAndComments(request, suffix);

    // --- Browser, as the plain (non-admin, non-leader) member ---
    await loginAs(page, member.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();

    // Normal board first — comment content is visible here (not the memory-game view).
    await expect(page.getByText(keepContent)).toBeVisible();
    await expect(page.getByText(improveContent)).toBeVisible();

    // The "משחק זיכרון" entry point is visible/enabled for a plain member — no isAdmin/role gate.
    const openMemoryBoardButton = page.getByText(Strings.memoryBoard.openButton);
    await expect(openMemoryBoardButton).toBeVisible();
    await openMemoryBoardButton.click();

    const boardUrl = page.url();

    // Two separate canvases (KEEP/IMPROVE), per product-backlog/08-memory-board.md §8.0 decision #2.
    await expect(page.getByText(Strings.memoryBoard.keepCanvasHeader)).toBeVisible();
    await expect(page.getByText(Strings.memoryBoard.improveCanvasHeader)).toBeVisible();

    // Cards render face-down: comment content is not just visually hidden but genuinely absent
    // from the DOM/accessibility tree (framer-motion's AnimatePresence mode="wait" unmounts the
    // non-active side entirely — see memory-card-web.tsx).
    await expect(page.getByText(keepContent)).toHaveCount(0);
    await expect(page.getByText(improveContent)).toHaveCount(0);
    await expect(page.getByText(Strings.retroBoard.categories.TESTING)).toHaveCount(0);
    await expect(page.getByText(Strings.retroBoard.anonymousAuthor)).toHaveCount(0);

    // Both cards start with the same "flip me" accessible name (no info leaked via aria-label).
    const faceDownCards = page.getByRole('button', { name: Strings.memoryBoard.flipCardHint });
    await expect(faceDownCards).toHaveCount(2);

    // Single click on the first face-down card (DOM order: KEEP canvas renders before IMPROVE)
    // flips it and reveals content + category + the real (non-anonymous) author name.
    await faceDownCards.first().click();
    await expect(page.getByText(keepContent)).toBeVisible();
    await expect(page.getByText(Strings.retroBoard.categories.TESTING)).toBeVisible();
    // Non-anonymous comment: the real author's username is shown, not "אנונימי".
    await expect(page.getByText(leaderUsername)).toBeVisible();
    // The IMPROVE card is still face-down.
    await expect(page.getByText(improveContent)).toHaveCount(0);
    await expect(page.getByRole('button', { name: Strings.memoryBoard.flipCardHint })).toHaveCount(1);

    // Flip the remaining (IMPROVE, anonymous) card — author name must read "אנונימי", never the
    // real poster's username, matching the server-side masking documented in comments.service.ts.
    await page.getByRole('button', { name: Strings.memoryBoard.flipCardHint }).first().click();
    await expect(page.getByText(improveContent)).toBeVisible();
    await expect(page.getByText(Strings.retroBoard.anonymousAuthor)).toBeVisible();

    // Double click on the already-flipped KEEP card enlarges it IN PLACE within the same canvas —
    // not a modal/new page: the URL doesn't change and both canvas headers are still on screen.
    const keepCard = page.locator('[role="button"]').filter({ hasText: keepContent });
    const sizeBefore = await keepCard.boundingBox();
    await keepCard.dblclick();
    const sizeAfter = await keepCard.boundingBox();
    expect(sizeBefore && sizeAfter).toBeTruthy();
    expect(sizeAfter!.width).toBeGreaterThan(sizeBefore!.width);
    expect(page.url()).toBe(boardUrl);
    await expect(page.getByText(Strings.memoryBoard.keepCanvasHeader)).toBeVisible();
    await expect(page.getByText(Strings.memoryBoard.improveCanvasHeader)).toBeVisible();
    // Content/author of the enlarged card are still the same card, not a duplicated/new one.
    await expect(page.getByText(keepContent)).toBeVisible();

    // Returning to the regular retro board via the same button.
    await page.getByText(Strings.memoryBoard.backButton).click();
    await expect(page.getByText(keepContent)).toBeVisible();
    await expect(page.getByText(Strings.memoryBoard.openButton)).toBeVisible();
  });

  test('flip state is local-only, not persisted: a reload, and a second user in a separate browser context, both see every card face-down again', async ({ page, request, browser }) => {
    // This test does three full login+navigate round-trips (initial nav, reload+renav, then a
    // second browser context's own nav) — genuinely more real work than the suite's other tests.
    // Measured ~24s even in a fresh, isolated run, which is close enough to the default 30s test
    // timeout to occasionally tip over when running late in a long sequential (workers: 1) suite.
    test.setTimeout(60_000);

    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const { teamName, leader, member, keepContent } = await setupTeamSprintAndComments(request, suffix);

    await loginAs(page, member.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await page.getByText(Strings.memoryBoard.openButton).click();

    const faceDownCards = page.getByRole('button', { name: Strings.memoryBoard.flipCardHint });
    await expect(faceDownCards).toHaveCount(2);
    await faceDownCards.first().click();
    await expect(page.getByText(keepContent)).toBeVisible();

    // Reload as the SAME user — product-backlog/08-memory-board.md §8.0 decision #4: flip state is `useState`
    // local to the component, never sent to the server, so a reload must show everything
    // face-down again, not restore the flipped card. The memory board is a real route now
    // (BUG-33), so the reload stays on it — no re-navigation needed — but the flip state is
    // still dropped, which is exactly what this asserts.
    await page.reload();
    await page.getByText(Strings.memoryBoard.keepCanvasHeader).waitFor();
    await expect(page.getByText(keepContent)).toHaveCount(0);
    await expect(page.getByRole('button', { name: Strings.memoryBoard.flipCardHint })).toHaveCount(2);

    // A second user (the team leader), in a completely separate browser context, also sees every
    // card face-down — the first user's flip is never synced/shared (no server-side state exists
    // for it at all, see comments.service.ts::getCommentsForSprint, which is unchanged by this
    // feature).
    const secondContext = await browser.newContext();
    try {
      const secondPage = await secondContext.newPage();
      await loginAs(secondPage, leader.token);
      await secondPage.getByText(teamName).waitFor();
      await secondPage.getByText(Strings.sprints.enterRetroButton).first().click();
      await secondPage.getByText(Strings.memoryBoard.openButton).click();
      await expect(secondPage.getByText(keepContent)).toHaveCount(0);
      await expect(secondPage.getByRole('button', { name: Strings.memoryBoard.flipCardHint })).toHaveCount(2);
    } finally {
      await secondContext.close();
    }
  });

  test('mobile: single-tap flips a card, double-tap flips and enlarges it, via real touch events (not just a mouse dblclick)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'Exercises the touch-driven gesture path — only meaningful under the Mobile Chrome (hasTouch) project.');

    const suffix = `${Date.now()}_${testInfo.project.name.replace(/\s+/g, '')}`;
    const { teamName, member, keepContent } = await setupTeamSprintAndComments(request, suffix);

    await loginAs(page, member.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await page.getByText(Strings.memoryBoard.openButton).click();

    const keepCard = page.getByRole('button', { name: Strings.memoryBoard.flipCardHint }).first();
    const box = await keepCard.boundingBox();
    expect(box).toBeTruthy();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;

    // A single tap (real touch events via CDP, not a synthesized mouse click) flips the card —
    // exercises the actual touch path on a mobile viewport, not just a reused desktop dblclick.
    await page.touchscreen.tap(x, y);
    await expect(page.getByText(keepContent)).toBeVisible();
    // Single tap only flips — it must not also enlarge.
    const sizeAfterSingleTap = (await page.locator('[role="button"]').filter({ hasText: keepContent }).boundingBox())!.width;

    // Two rapid taps on the SAME (already-flipped) card — a double-tap — must also enlarge it,
    // and must not trigger the browser's own native double-tap-to-zoom instead of our handler:
    // the page's visual viewport scale stays 1, and the card (not the whole page) is what grows.
    const scaleBefore = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
    const scaleAfter = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    expect(scaleAfter).toBe(scaleBefore);

    const sizeAfterDoubleTap = (await page.locator('[role="button"]').filter({ hasText: keepContent }).boundingBox())!.width;
    expect(sizeAfterDoubleTap).toBeGreaterThan(sizeAfterSingleTap);
  });
});
