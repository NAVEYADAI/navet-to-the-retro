import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

// Feature 22 (product-backlog/22-interactive-guide.md §22.3): the interactive "כפתור כפתור" guide —
// it highlights the REAL element, waits for the user to press it / write a note, moves between
// screens by itself, and never writes anything of its own.

// This spec tests the real first-run behaviour, so it clears the suite-wide "no auto-start" switch.
test.use({ storageState: { cookies: [], origins: [] } });

const BACKEND_URL = 'http://localhost:5006';
const APPROVER_EMAIL = 'lironka13@gmail.com';
const DAY = 24 * 60 * 60 * 1000;
const G = Strings.onboarding.guide;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
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

async function approvedTeam(request: APIRequestContext, leaderToken: string, approver: string, name: string) {
  const team = await (await request.post(`${BACKEND_URL}/teams`, { headers: auth(leaderToken), data: { name, approverEmail: APPROVER_EMAIL } })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver) });
  return team.id as number;
}

async function sprint(request: APIRequestContext, token: string, teamId: number, name: string, start: string, end: string) {
  return (await (await request.post(`${BACKEND_URL}/teams/${teamId}/sprints`, { headers: auth(token), data: { name, startDate: start, endDate: end } })).json()).id as number;
}

async function joinViaInvite(request: APIRequestContext, teamId: number, leaderToken: string, memberToken: string) {
  const invite = await (await request.post(`${BACKEND_URL}/teams/${teamId}/invites`, { headers: auth(leaderToken), data: {} })).json();
  const res = await request.post(`${BACKEND_URL}/invites/${invite.token}/consume`, { headers: auth(memberToken) });
  expect(res.ok()).toBeTruthy();
}

async function loginAndGoto(page: Page, token: string, path = '/') {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.goto(path);
}

const bubble = (page: Page) => page.getByTestId('guide-bubble');
const stepIs = async (page: Page, id: string) => expect(bubble(page)).toHaveAttribute('data-step-id', id, { timeout: 15_000 });
const nextButton = (page: Page) => bubble(page).getByRole('button', { name: new RegExp(`^(${G.next}|${G.finish})$`) });
const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const stepsSeen = async (page: Page) => (await bubble(page).getAttribute('data-step-id')) as string;

/** The highlight ring sits on `target` (+6px of air on each side) — i.e. it really points at the element. */
async function expectHighlightOn(page: Page, target: Locator) {
  const tol = 4;
  // The ring follows the element frame by frame (and the page may still be scrolling it into view), so wait for it to settle.
  await expect.poll(async () => {
    const ring = await page.getByTestId('guide-highlight').boundingBox();
    const box = await target.boundingBox();
    if (!ring || !box) return 'not on screen';
    const off = Math.max(
      Math.abs(ring.x - (box.x - 6)), Math.abs(ring.y - (box.y - 6)),
      Math.abs(ring.width - (box.width + 12)), Math.abs(ring.height - (box.height + 12)),
    );
    return off <= tol ? 'on target' : `off by ${Math.round(off)}px`;
  }, { timeout: 8000 }).toBe('on target');
}

test.describe('Interactive guide', () => {
  test('a brand-new user gets the basic guide once: real presses, a demo board that writes nothing, and it never reopens', async ({ page, request }) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_new`;
    const user = await register(request, `e2e_pw_gd_new_${suffix}`);
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && !r.url().includes('/onboarding/') && r.url().includes('localhost:5006')) writes.push(`${r.method()} ${r.url()}`);
    });

    await loginAndGoto(page, user.token);
    // opened by itself, on the welcome step (no anchor: a centred note over a dimmed screen)
    await stepIs(page, 'welcome');
    await expect(page.getByTestId('guide-highlight')).toHaveCount(0);
    await expect(bubble(page)).toContainText(G.steps.welcome.title);
    expect(await noSidewaysScroll(page)).toBe(true);
    await nextButton(page).click();

    // "צוות חדש": the guide points at the real button and waits for the real click
    await stepIs(page, 'new-team');
    await expectHighlightOn(page, page.getByRole('button', { name: Strings.dashboard.newTeamButton }));
    await expect(page.getByTestId('guide-hint')).toHaveText(G.actionHint);
    await expect(nextButton(page)).toHaveCount(0);
    await page.getByRole('button', { name: Strings.dashboard.newTeamButton }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await stepIs(page, 'create-team-form');
    await expect(page.getByTestId('guide-highlight')).toBeVisible();
    await nextButton(page).click();

    // no sprint yet → the demo board stands in, and writing in it is what moves the guide on
    await stepIs(page, 'board-demo-write');
    await expect(page.getByTestId('guide-demo-board')).toBeVisible();
    await expect(page.getByText(G.demoBadge).first()).toBeVisible();
    await expect(page.getByTestId('guide-hint')).toHaveText(G.writeHint);
    const note = `e2e demo note ${suffix}`;
    await page.getByTestId('guide-demo-board').getByRole('textbox').fill(note);
    await page.getByTestId('guide-demo-board').getByRole('button', { name: G.demoPostButton }).click();
    await stepIs(page, 'board-demo-comments');
    await expect(page.getByTestId('guide-demo-board').getByText(note)).toBeVisible();
    await nextButton(page).click();
    await stepIs(page, 'summary-info');
    await nextButton(page).click();
    await stepIs(page, 'done');
    await nextButton(page).click();
    await expect(bubble(page)).toHaveCount(0);

    // the demo never reached the server: no write of any kind (only the onboarding bookkeeping)
    expect(writes).toEqual([]);
    const status = await (await request.get(`${BACKEND_URL}/onboarding/status`, { headers: auth(user.token) })).json();
    expect(status.guideAutoStart).toBe(false);

    // and it does not come back by itself — not after a reload either
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(bubble(page)).toHaveCount(0);
  });

  test('a team leader walks the whole basic guide with real clicks and a real note, across screens', async ({ page, request }) => {
    test.setTimeout(300_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_lead`;
    const leader = await register(request, `e2e_pw_gd_lead_${suffix}`);
    const approver = await approverToken(request, `e2e_pw_gd_appr_${suffix}`);
    const teamId = await approvedTeam(request, leader.token, approver, `E2E GD Team ${suffix}`);
    const activeId = await sprint(request, leader.token, teamId, 'Active', day(-2), day(8));
    const endedId = await sprint(request, leader.token, teamId, 'Ended', day(-30), day(-16));
    // an existing user (a team with sprints) is not auto-started; this one opens the guide from the menu
    await loginAndGoto(page, leader.token);
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(bubble(page)).toHaveCount(0);

    await page.getByTestId('guide-menu-trigger').getByRole('button').click();
    await page.getByTestId('guide-menu-basic').click();
    await stepIs(page, 'welcome');
    await nextButton(page).click();

    // team card: open the members list by pressing the real toggle
    await stepIs(page, 'members-toggle');
    const toggle = page.getByRole('button', { name: /^.*חברים/ }).first();
    await expectHighlightOn(page, toggle);
    await toggle.click();

    // "הוסף חבר" opens the real dialog; the highlight follows into it
    await stepIs(page, 'add-member');
    await page.getByRole('button', { name: Strings.teamList.addMemberToggle }).click();
    await stepIs(page, 'add-member-modal');
    const dialog = page.getByRole('dialog').filter({ hasText: Strings.teamList.addMemberModalTitle });
    await expect(page.getByTestId('guide-highlight')).toBeVisible();
    // switching tabs changes the dialog's height; the highlight follows it
    const before = await page.getByTestId('guide-highlight').boundingBox();
    await dialog.getByText(Strings.teamList.addMemberTabLink, { exact: true }).click();
    await expect.poll(async () => (await page.getByTestId('guide-highlight').boundingBox())?.height ?? 0, { timeout: 5000 }).not.toBe(before!.height);
    await nextButton(page).click();
    await stepIs(page, 'add-member-close');
    await dialog.getByRole('button', { name: Strings.teamList.closeModalLabel }).click();

    await stepIs(page, 'sprint-new');
    await expectHighlightOn(page, page.getByRole('button', { name: Strings.sprints.newSprintButton }));
    await nextButton(page).click();

    // the board: the guide navigates there by itself and waits for a real note
    await stepIs(page, 'board-write');
    await expect(page).toHaveURL(new RegExp(`/team/${teamId}/sprint/${activeId}$`));
    await expect(page.getByTestId('guide-highlight')).toBeVisible();
    await expect(page.getByTestId('guide-hint')).toHaveText(G.writeHint);
    const note = `e2e guide note ${suffix}`;
    await page.getByRole('textbox').first().fill(note);
    await page.getByRole('button', { name: Strings.retroBoard.postNoteButton }).click();
    await stepIs(page, 'board-comments');
    await expect(page.getByText(note).first()).toBeVisible();
    await nextButton(page).click();

    await stepIs(page, 'summary');
    await expect(page).toHaveURL(new RegExp(`/team/${teamId}/sprint/${endedId}/summary$`));
    await nextButton(page).click();

    await stepIs(page, 'focus-points');
    await expect(page).toHaveURL(new RegExp(`/team/${teamId}/focus-points$`));
    await expectHighlightOn(page, page.getByRole('button', { name: Strings.focusPoints.newPointButton }));
    await nextButton(page).click();

    await stepIs(page, 'done');
    await nextButton(page).click();
    await expect(bubble(page)).toHaveCount(0);

    // the note the guide asked for is a real comment on the real sprint
    const comments = await (await request.get(`${BACKEND_URL}/sprints/${activeId}/comments`, { headers: auth(leader.token) })).json();
    expect(comments.map((c: { content: string }) => c.content)).toContain(note);
  });

  test('a plain member sees no management steps; Esc leaves, and starting again begins at step 1', async ({ page, request }) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_member`;
    const leader = await register(request, `e2e_pw_gd_ml_${suffix}`);
    const member = await register(request, `e2e_pw_gd_mm_${suffix}`);
    const approver = await approverToken(request, `e2e_pw_gd_appr2_${suffix}`);
    const teamId = await approvedTeam(request, leader.token, approver, `E2E GD Member ${suffix}`);
    await joinViaInvite(request, teamId, leader.token, member.token);
    await sprint(request, leader.token, teamId, 'Active', day(-2), day(8));

    await loginAndGoto(page, member.token);
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    await page.getByTestId('guide-menu-trigger').getByRole('button').click();
    await page.getByTestId('guide-menu-basic').click();

    const seen: string[] = [];
    await stepIs(page, 'welcome');
    seen.push(await stepsSeen(page));
    await nextButton(page).click();
    await stepIs(page, 'members-toggle');
    seen.push(await stepsSeen(page));
    // a member is not offered the add-member / sprint / focus-point steps; the toggle's press moves on to the board
    await page.getByRole('button', { name: /^.*חברים/ }).first().click();
    await stepIs(page, 'board-write');
    seen.push(await stepsSeen(page));
    expect(seen).toEqual(['welcome', 'members-toggle', 'board-write']);

    // Esc leaves; no dialog behind it was closed by the same key press
    await page.keyboard.press('Escape');
    await expect(bubble(page)).toHaveCount(0);

    // progress is not kept: it starts from the beginning
    await page.getByTestId('guide-menu-trigger').getByRole('button').click();
    await page.getByTestId('guide-menu-basic').click();
    await stepIs(page, 'welcome');
    await bubble(page).getByRole('button', { name: G.exit }).click();
    await expect(bubble(page)).toHaveCount(0);
  });

  test('a missing anchor does not trap the user: the step falls back to a centred note and "הבא" works', async ({ page, request }) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_missing`;
    const leader = await register(request, `e2e_pw_gd_ms_${suffix}`);
    const approver = await approverToken(request, `e2e_pw_gd_appr3_${suffix}`);
    const teamId = await approvedTeam(request, leader.token, approver, `E2E GD Missing ${suffix}`);
    await sprint(request, leader.token, teamId, 'Active', day(-2), day(8));

    await loginAndGoto(page, leader.token);
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    // hide the sprint button so its anchor has nothing to measure
    await page.addStyleTag({ content: '[data-tour="sprint-new"] * { display: none !important; }' });
    await page.getByTestId('guide-menu-trigger').getByRole('button').click();
    await page.getByTestId('guide-menu-basic').click();
    await stepIs(page, 'welcome');
    await nextButton(page).click();
    await stepIs(page, 'members-toggle');
    await bubble(page).getByRole('button', { name: G.skipStep }).click();
    // the members list was never opened, so the next three anchors don't exist: each waits, then becomes a plain note
    for (const id of ['add-member', 'add-member-modal', 'add-member-close']) {
      await stepIs(page, id);
      await expect(bubble(page)).toHaveAttribute('data-located', 'missing', { timeout: 15_000 });
      await expect(page.getByTestId('guide-highlight')).toHaveCount(0);
      await nextButton(page).click();
    }
    await stepIs(page, 'sprint-new');
    // after the wait it is a centred note with a plain "הבא" and no highlight
    await expect(bubble(page)).toHaveAttribute('data-located', 'missing', { timeout: 15_000 });
    await expect(page.getByTestId('guide-highlight')).toHaveCount(0);
    await nextButton(page).click();
    await stepIs(page, 'board-write');
  });

  test('the advanced guide points at settings cards, with no sideways scroll at phone width', async ({ page, request }) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_adv`;
    const user = await register(request, `e2e_pw_gd_adv_${suffix}`);
    await loginAndGoto(page, user.token);
    await expect(page.getByRole('heading', { level: 1, name: Strings.teamList.myTeamsHeader })).toBeVisible();
    // the first-run guide opens by itself for this brand-new user: leave it, then use the menu
    await stepIs(page, 'welcome');
    await bubble(page).getByRole('button', { name: G.exit }).click();

    await page.getByTestId('guide-menu-trigger').getByRole('button').click();
    await page.getByTestId('guide-menu-advanced').click();
    await stepIs(page, 'adv-welcome');
    await nextButton(page).click();
    for (const id of ['settings-telegram', 'settings-google', 'settings-appearance']) {
      await stepIs(page, id);
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByTestId('guide-highlight')).toBeVisible();
      expect(await noSidewaysScroll(page)).toBe(true);
      const box = await bubble(page).boundingBox();
      const vp = page.viewportSize()!;
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
      await nextButton(page).click();
    }
    await stepIs(page, 'adv-categories-info');
    await nextButton(page).click();
    await stepIs(page, 'adv-done');
    await nextButton(page).click();
    await expect(bubble(page)).toHaveCount(0);
  });
});
