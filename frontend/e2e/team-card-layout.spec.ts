import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';
import { openMembers, openAddMemberModal, openTeamSettings } from './team-members-ui';

const BACKEND_URL = 'http://localhost:5006';
// Hardcoded approver allowlist (backend/src/teams/teams.service.ts) — safe: isolated test DB only.
const APPROVER_EMAIL = 'lironka13@gmail.com';
const DAY = 24 * 60 * 60 * 1000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, { data: { username, email, password: 'password123' } });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) {
    const body = await registerRes.json();
    return { token: body.accessToken as string, id: body.user.id as number };
  }
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  const body = await loginRes.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

async function loginViaLocalStorage(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.reload();
}

test.describe('Team card layout — collapsed members, add-member modal, sprint lifecycle groups', () => {
  test('members hide behind a button, one modal adds a member, ended sprints expire after 3 days', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_layout`;
    const teamName = `E2E Layout Team ${suffix}`;
    const activeName = `Active ${suffix}`;
    const upcomingName = `Upcoming ${suffix}`;
    const recentName = `Recent ${suffix}`;
    const oldName = `Old ${suffix}`;

    const leader = await registerAndLogin(request, `e2e_pw_layout_${suffix}`, `e2e_pw_layout_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_layout_approver_${suffix}`);
    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: { Authorization: `Bearer ${approver.token}` } });

    for (const [name, start, end] of [
      [activeName, day(-3), day(7)],
      [upcomingName, day(5), day(15)],
      [recentName, day(-12), day(-2)], // ended 2 days ago -> still in the main view
      [oldName, day(-30), day(-20)], // ended 20 days ago -> expired group
    ]) {
      await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
        headers: { Authorization: `Bearer ${leader.token}` },
        data: { name, startDate: start, endDate: end },
      });
    }

    await loginViaLocalStorage(page, leader.token);
    await page.getByText(teamName).waitFor();

    // --- Sprints: active + recently-ended are visible, the old one is collapsed away ---
    await expect(page.getByText(activeName)).toBeVisible();
    // The summary under the team name no longer repeats the member count (the members chip shows it).
    await expect(page.getByText(Strings.teamList.summaryActiveSprints(1), { exact: true })).toBeVisible();
    await expect(page.getByText(/^\d+ חברים|^חבר אחד/)).toHaveCount(0);
    // Active sprint: progress bar + "יום X מתוך Y"; upcoming sprint: "מתחיל בעוד N ימים".
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByText(/^יום \d+ מתוך \d+$/)).toBeVisible();
    // The active row stays on one line at every width: name, progress and "enter" share a row.
    const activeRow = page.getByTestId('open-sprint-row').filter({ hasText: activeName });
    const [nameBox, barBox, linkBox] = await Promise.all([
      activeRow.getByText(activeName).boundingBox(),
      activeRow.getByRole('progressbar').boundingBox(),
      activeRow.getByText(Strings.sprints.enterRetroButton).boundingBox(),
    ]);
    const overlapsVertically = (a: typeof nameBox, b: typeof nameBox) => !!a && !!b && a.y < b.y + b.height && b.y < a.y + a.height;
    const rowBox = await activeRow.boundingBox();
    expect(overlapsVertically(barBox, linkBox)).toBe(true);
    expect(overlapsVertically(rowBox, nameBox) && overlapsVertically(rowBox, barBox)).toBe(true);
    // RTL: the bar sits beside the name (to its left), not wrapped underneath it.
    expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(nameBox!.x + 1);
    await expect(page.getByText(upcomingName)).toBeVisible();
    await expect(page.getByText(/^מתחיל בעוד \d+ ימים$/)).toBeVisible();
    await expect(page.getByText(Strings.sprints.recentHeader)).toBeVisible();
    await expect(page.getByText(recentName)).toBeVisible();
    await expect(page.getByText(oldName)).toHaveCount(0);
    await page.getByText(Strings.sprints.expiredHeader(1)).click();
    await expect(page.getByText(oldName)).toBeVisible();

    // --- Filter: a single compact button (3 sprints are listed), opening a menu ---
    const filterButton = page.getByRole('button', { name: Strings.sprints.filterButtonLabel });
    await filterButton.click();
    await page.getByRole('menuitem', { name: Strings.sprints.filterOptions.active }).click();
    await expect(page.getByText(upcomingName)).toHaveCount(0);
    await expect(page.getByText(Strings.sprints.recentHeader)).toHaveCount(0);
    await expect(page.getByText(activeName)).toBeVisible();
    await expect(filterButton).toContainText(Strings.sprints.filterOptions.active);
    await filterButton.click();
    await page.getByRole('menuitem', { name: Strings.sprints.filterOptions.all }).click();
    await expect(page.getByText(upcomingName)).toBeVisible();

    // --- Card header: the members chip sits beside the team name (to its left), never wrapped under it ---
    const membersChip = page.getByRole('button', { name: /^חברים · \d+$/ });
    const [teamNameBox, chipBox] = await Promise.all([page.getByRole('heading', { name: teamName }).boundingBox(), membersChip.boundingBox()]);
    expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(teamNameBox!.x + 1);
    expect(chipBox!.y).toBeLessThan(teamNameBox!.y + teamNameBox!.height);

    // --- Refresh in the sprints header: icon only on phones, labelled everywhere ---
    const sprintRefresh = page.getByRole('button', { name: Strings.common.refreshButton }).last();
    await expect(sprintRefresh).toBeVisible();
    const refreshLabel = sprintRefresh.getByText(Strings.common.refreshButton);
    if (test.info().project.name.includes('Mobile')) await expect(refreshLabel).toBeHidden();
    else await expect(refreshLabel).toBeVisible();

    // --- Members: hidden until the button is pressed ---
    await expect(page.getByText(Strings.teamList.addMemberToggle, { exact: true })).toHaveCount(0);
    await openMembers(page);
    await expect(page.getByText(Strings.teamList.addMemberToggle, { exact: true })).toBeVisible();
    await expect(page.getByText(Strings.teamList.membersHeader, { exact: true })).toBeVisible();

    // --- Settings: behind the gear, mutually exclusive with the members panel ---
    await openTeamSettings(page);
    await expect(page.getByText(Strings.categoryManagement.categorySectionTitle)).toBeVisible();
    await expect(page.getByText(Strings.teamList.addMemberToggle, { exact: true })).toHaveCount(0);
    await openMembers(page);

    // --- One modal, three tabs ---
    await openAddMemberModal(page);
    await expect(page.getByText(Strings.teamList.addMemberModalTitle)).toBeVisible();
    await expect(page.getByText(Strings.teamList.addMemberTabExisting, { exact: true })).toBeVisible();
    await expect(page.getByText(Strings.teamList.addMemberTabPhantom, { exact: true })).toBeVisible();
    await expect(page.getByText(Strings.teamList.addMemberTabLink, { exact: true })).toBeVisible();
    // The modal renders in a portal outside the page's RTL container — it must still be RTL:
    // the title on the right, the close button on the left, the first tab on the right.
    const dialog = page.getByRole('dialog');
    expect(await dialog.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
    const [titleBox, closeBox] = await Promise.all([
      dialog.getByText(Strings.teamList.addMemberModalTitle).boundingBox(),
      dialog.getByRole('button', { name: Strings.teamList.closeModalLabel }).boundingBox(),
    ]);
    expect(closeBox!.x).toBeLessThan(titleBox!.x);
    // The tabs fill the whole selector — no empty strip beside the last tab.
    const existingTab = dialog.getByText(Strings.teamList.addMemberTabExisting, { exact: true });
    const linkTab = dialog.getByText(Strings.teamList.addMemberTabLink, { exact: true });
    const selector = existingTab.locator('..');
    const [existingBox, linkBox2, selectorBox] = await Promise.all([existingTab.boundingBox(), linkTab.boundingBox(), selector.boundingBox()]);
    expect(existingBox!.x).toBeGreaterThan(linkBox2!.x);
    expect(linkBox2!.x - selectorBox!.x).toBeLessThan(8);

    await page.getByText(Strings.teamList.addMemberTabPhantom, { exact: true }).click();
    await page.getByPlaceholder(Strings.teamList.phantomFirstNameLabel).fill('Layout');
    await page.getByText(Strings.teamList.addPhantomMemberButton).click();

    // The modal closes and the new member shows up in the (still open) members list.
    await expect(page.getByText(Strings.teamList.addMemberModalTitle)).toHaveCount(0);
    await expect(page.getByText(Strings.teamList.phantomBadge)).toBeVisible();
  });

  test('no filter button when only one sprint is listed (ended sprints in the collapsed group do not count)', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_nofilter`;
    const teamName = `E2E NoFilter Team ${suffix}`;
    const leader = await registerAndLogin(request, `e2e_pw_nofilter_${suffix}`, `e2e_pw_nofilter_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_layout_approver_${suffix}`);
    const team = await (await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    })).json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: { Authorization: `Bearer ${approver.token}` } });
    for (const [name, start, end] of [[`Only ${suffix}`, day(-1), day(9)], [`Gone ${suffix}`, day(-40), day(-30)]]) {
      await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
        headers: { Authorization: `Bearer ${leader.token}` },
        data: { name, startDate: start, endDate: end },
      });
    }

    await loginViaLocalStorage(page, leader.token);
    await expect(page.getByText(`Only ${suffix}`)).toBeVisible();
    await expect(page.getByText(Strings.sprints.expiredHeader(1))).toBeVisible();
    await expect(page.getByRole('button', { name: Strings.sprints.filterButtonLabel })).toHaveCount(0);
  });
});
