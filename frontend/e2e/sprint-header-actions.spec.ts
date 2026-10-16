import { test, expect, type APIRequestContext } from '@playwright/test';
import { Strings } from '../src/constants/strings';
import { sprintMoreActionsButton, openSprintTools } from './sprint-actions-ui';

const BACKEND_URL = 'http://localhost:5006';
const APPROVER_EMAIL = 'naveyadai@gmail.com';

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, { data: { username, email, password: 'password123' } });
  const body = await res.json();
  return { token: body.accessToken as string };
}

async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) return { token: (await registerRes.json()).accessToken as string };
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  return { token: (await loginRes.json()).accessToken as string };
}

test.describe('Sprint header actions', () => {
  test('destinations hide behind the collapsed tools row, management behind the "⋯" menu, no horizontal overflow', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const admin = await registerAndLogin(request, `e2e_pw_hdr_admin_${suffix}`, `e2e_pw_hdr_admin_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_hdr_approver_${suffix}`);
    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: `E2E Header Team ${suffix}`, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: { Authorization: `Bearer ${approver.token}` } });
    const today = new Date();
    await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: {
        name: `E2E Header Sprint ${suffix}`,
        startDate: today.toISOString().slice(0, 10),
        endDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      },
    });

    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('userToken', token), admin.token);
    await page.reload();
    await page.getByText(`E2E Header Team ${suffix}`).waitFor();
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await page.getByText(Strings.retroBoard.writeNoteHeader).waitFor();

    // Destinations: collapsed by default, one tap opens the tiles.
    await expect(page.getByRole('button', { name: Strings.memoryBoard.openButton })).toHaveCount(0);
    await openSprintTools(page);
    const tiles = [Strings.sprintSummary.openButton, Strings.memoryBoard.openButton].map((name) => page.getByRole('button', { name }));
    for (const tile of tiles) await expect(tile).toBeVisible();
    const tops = await Promise.all(tiles.map(async (tile) => Math.round((await tile.boundingBox())!.y)));
    expect(new Set(tops).size).toBe(1);

    // Management: not in the header row, only inside the menu.
    await expect(page.getByRole('button', { name: Strings.retroBoard.editSprintButton })).toHaveCount(0);
    await sprintMoreActionsButton(page).click();
    await expect(page.getByRole('menuitem', { name: Strings.retroBoard.editSprintButton })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: Strings.sprintDeletion.deleteButton })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: Strings.retroBoard.editSprintButton })).toHaveCount(0);

    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
  });
});
